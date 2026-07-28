import type { SyncResult } from '../../shared/types'
import * as accounts from './accounts'
import { optionalEnv } from './env'
import { llmJson } from './llm'
import * as mailbox from './mailbox'
import { triagePrompt, type TriageInput } from './prompts'
import * as store from './store'

const SNIPPET_BATCH = 25 // preview texts pulled per pass (one IMAP connection)
const TRIAGE_BATCH = 25 // emails sorted per LLM call — cheap, metadata only
const MAX_BATCHES_PER_RUN = 2
const DEBOUNCE_MS = 3 * 60_000

interface TriageOut {
  index: number
  category: string
  newCategory?: { label?: string; description?: string }
  priority?: string
  actionRequired?: boolean
  suggestReply?: boolean
}

// Colors handed to AI-invented categories, in rotation.
const CATEGORY_PALETTE = [
  '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444',
  '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#6366F1',
]
const MAX_CATEGORIES = 14

/** Cuts quoted reply-chains so the AI reads THIS message, not the whole trace. */
export function stripQuoted(text: string): string {
  const patterns = [
    /^On .{0,120} wrote:\s*$/m,
    /^-{2,}\s*(Original|Forwarded) Message/im,
    /^From:\s.+\r?\n(Sent|Date):\s/m,
    /^_{10,}\s*$/m,
  ]
  let cut = text.length
  for (const re of patterns) {
    const m = re.exec(text)
    if (m && m.index < cut) cut = m.index
  }
  const head = text.slice(0, cut).trim()
  return head.length >= 60 ? head : text
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function todayIn(timezone: string): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())
}

/**
 * One sync pass across EVERY connected mail account (Gmail and IMAP):
 *  1. Pull new message metadata; walk history backward toward the first email.
 *  2. Pull a short preview for anything missing one — no AI.
 *  3. TRIAGE: one cheap AI call sorts 25 emails (category, priority, spam,
 *     worth-replying) from metadata + preview only.
 *  4. Renew Gmail push watches nearing expiry.
 * Full summaries and reply drafts are NOT produced here — they are generated
 * on demand when the CEO opens an email (see functions/email-analyze.ts).
 * Bounded per invocation; call again while `pending` > 0.
 */
export async function runSync(
  opts: {
    force?: boolean
    debounceMs?: number
    accountId?: string
    /** Light pass for latency-sensitive callers (digest): no history dig. */
    light?: boolean
  } = {},
): Promise<SyncResult> {
  const all = await accounts.listAllAccounts()
  const targets = opts.accountId ? all.filter((a) => a.id === opts.accountId) : all
  const debounce = opts.debounceMs ?? DEBOUNCE_MS

  let newEmails = 0
  let anyFetched = false
  for (const acc of targets) {
    const firstEver = acc.lastSyncAt === null
    const fresh = acc.lastSyncAt !== null && Date.now() - Date.parse(acc.lastSyncAt) < debounce
    if (fresh && !opts.force) continue
    anyFetched = true
    // How far back the first sync reaches is the owner's choice (Settings →
    // "Load mail from"); later syncs only look at the last few days.
    let historyDays = 90
    try {
      historyDays = (await store.getSettings(acc.userId)).historyDays
    } catch {
      /* default */
    }
    const folders: { folder: 'inbox' | 'sent'; sinceDays: number; max: number }[] = [
      { folder: 'inbox', sinceDays: firstEver ? historyDays : 3, max: firstEver ? 300 : 50 },
      { folder: 'sent', sinceDays: firstEver ? historyDays : 3, max: firstEver ? 200 : 30 },
    ]
    let accNew = 0
    for (const f of folders) {
      try {
        const known = await store.knownProviderIds(
          acc.id,
          new Date(Date.now() - (f.sinceDays + 1) * 86400_000).toISOString(),
          f.folder,
        )
        const metas = await mailbox.fetchNewMetas(acc, {
          sinceDays: f.sinceDays,
          max: f.max,
          known,
          folder: f.folder,
        })
        // Persist in chunks so progress survives even if the invocation dies.
        for (let i = 0; i < metas.length; i += 20) {
          accNew += await store.upsertEmailMetas(
            acc.id,
            acc.userId,
            metas.slice(i, i + 20),
            f.folder,
          )
        }
      } catch (e) {
        console.error(`sync failed for ${acc.email} ${f.folder} (continuing)`, e)
      }
    }

    // History dig: one batch per folder per sync, walking backward through the
    // chosen window. Skipped while a busy recent fetch already filled this run,
    // and skipped entirely when the owner asked for a short window.
    const digCutoff = Date.now() - historyDays * 86400_000
    if (!opts.light && accNew < 50) {
      for (const f of ['inbox', 'sent'] as const) {
        try {
          const oldest = await store.oldestEmail(acc.id, f)
          if (!oldest || Date.parse(oldest.receivedAt) < digCutoff) continue
          const known = await store.knownProviderIds(
            acc.id,
            new Date(Date.parse(oldest.receivedAt) - 3 * 86400_000).toISOString(),
            f,
          )
          const dug = await mailbox.fetchOlderMetas(acc, { folder: f, oldest, known })
          for (let i = 0; i < dug.length; i += 20) {
            accNew += await store.upsertEmailMetas(acc.id, acc.userId, dug.slice(i, i + 20), f)
          }
        } catch (e) {
          console.error(`history dig failed for ${acc.email} ${f} (continuing)`, e)
        }
      }
    }

    newEmails += accNew
    await accounts.touchAccountSync(acc.id).catch(() => {})
  }

  const accById = new Map(all.map((a) => [a.id, a]))

  // ── Pass 1: preview text (no AI) ────────────────────────────────────────────
  // One connection per account pulls short previews for anything missing one.
  // This alone makes the list feel like a real mail app immediately.
  try {
    const needSnippet = await store.listNeedingSnippet(SNIPPET_BATCH)
    const byAcc = new Map<string, typeof needSnippet>()
    for (const row of needSnippet) {
      const list = byAcc.get(row.accountId) ?? []
      list.push(row)
      byAcc.set(row.accountId, list)
    }
    for (const [accId, rows] of byAcc) {
      const acc = accById.get(accId)
      if (!acc) continue
      try {
        const bodies = await mailbox.getBodies(
          acc,
          rows.map((r) => store.providerIdOf(r)),
        )
        for (const r of rows) {
          const body = bodies.get(store.providerIdOf(r))
          if (!body) continue
          const preview = stripQuoted(body).replace(/\s+/g, ' ').trim().slice(0, 300)
          if (preview) await store.saveSnippet(r.id, preview)
        }
      } catch (e) {
        console.error('preview fetch failed', acc.email, e)
      }
    }
  } catch (e) {
    console.error('preview pass failed', e)
  }

  // ── Pass 2: triage ──────────────────────────────────────────────────────────
  // ONE cheap AI call sorts 25 emails from metadata + preview: category,
  // priority, spam, worth-replying. Deep summaries and reply drafts are
  // generated later, only for the email the CEO actually opens.
  let summarized = 0
  const maxBatches = opts.light ? 1 : MAX_BATCHES_PER_RUN
  for (let b = 0; b < maxBatches; b++) {
    const candidates = await store.listUnsummarized(TRIAGE_BATCH * 2)
    if (candidates.length === 0) break
    const batchUserId = accById.get(candidates[0].accountId)?.userId
    if (!batchUserId) break
    const rows = candidates
      .filter((r) => accById.get(r.accountId)?.userId === batchUserId)
      .slice(0, TRIAGE_BATCH)
    if (rows.length === 0) break

    const settings = await store.getSettings(batchUserId)
    const validKeys = new Set(settings.categories.map((c) => c.key))
    let categoriesDirty = false
    const today = todayIn(settings.timezone)

    const inputs: TriageInput[] = rows.map((row, i) => ({
      index: i,
      from: `${row.fromName} <${row.fromEmail}>`,
      subject: row.subject,
      date: row.receivedAt,
      preview: (row.snippet || '(no preview)').slice(0, 260),
    }))

    try {
      const out = await llmJson<{ results: TriageOut[] } | TriageOut[]>(
        triagePrompt(inputs, settings.categories, today),
        { maxTokens: 1800, provider: settings.llmProvider },
      )
      const results = Array.isArray(out) ? out : (out.results ?? [])
      for (const r of results) {
        const row = rows[r.index]
        if (!row) continue
        // The AI owns the taxonomy: when nothing fits, it invents a category
        // that becomes part of this user's set from then on.
        let category = r.category
        if (!validKeys.has(category)) {
          const label = r.newCategory?.label?.trim()
          const key = label ? slugify(label) : ''
          if (key && validKeys.has(key)) {
            category = key
          } else if (key && label && settings.categories.length < MAX_CATEGORIES) {
            settings.categories.push({
              key,
              label: label.slice(0, 30),
              color: CATEGORY_PALETTE[settings.categories.length % CATEGORY_PALETTE.length],
              description: String(r.newCategory?.description ?? '').slice(0, 200),
            })
            validKeys.add(key)
            categoriesDirty = true
            category = key
          } else {
            category = 'system'
          }
        }
        const p = String(r.priority ?? 'normal')
        await store.saveTriage(row.id, {
          category,
          priority:
            p === 'high' || p === 'low' || p === 'spam' ? (p as 'high' | 'low' | 'spam') : 'normal',
          actionRequired: Boolean(r.actionRequired),
          suggestReply: Boolean(r.suggestReply),
        })
        summarized++
      }
      if (categoriesDirty) {
        await store.saveSettings(batchUserId, settings).catch((e) => {
          console.error('saving AI-created categories failed', e)
        })
      }
    } catch (e) {
      // Rate limit or provider hiccup: rows stay pending for the next pass.
      console.error('triage batch failed (will retry next sync)', e)
      break
    }
  }

  if (anyFetched && !opts.light) await renewWatchesIfDue(all)

  const pending = await store.countUnsummarized()
  return { skipped: !anyFetched && !opts.force, newEmails, summarized, drafted: 0, pending }
}

/** Keeps real-time push alive: Gmail watches expire every ~7 days. */
async function renewWatchesIfDue(all: accounts.Account[]): Promise<void> {
  const topic = optionalEnv('GMAIL_PUSH_TOPIC')
  if (!topic) return // push not configured — hourly cron + app-open sync still work
  const { watchInbox } = await import('./gmail')
  for (const acc of all) {
    if (acc.kind !== 'gmail' || !acc.refreshTokenEnc) continue
    const dueSoon =
      acc.watchExpiresAt === null || Date.parse(acc.watchExpiresAt) - Date.now() < 24 * 3600_000
    if (!dueSoon) continue
    try {
      const { expiresAt } = await watchInbox(acc, topic)
      await accounts.saveAccountWatch(acc.id, expiresAt)
    } catch (e) {
      console.error(`gmail watch renewal failed for ${acc.email} (will retry next sync)`, e)
    }
  }
}
