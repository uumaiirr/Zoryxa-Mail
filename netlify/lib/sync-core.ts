import type { Deadline, SyncResult } from '../../shared/types'
import * as accounts from './accounts'
import { optionalEnv } from './env'
import { llmJson } from './llm'
import * as mailbox from './mailbox'
import { replyPrompt, summarizeBatchPrompt, type SummarizeInput } from './prompts'
import * as store from './store'

const BATCH_SIZE = 5 // emails per LLM call — small enough for free-tier TPM limits
const MAX_BATCHES_PER_RUN = 2 // callers re-invoke while `pending` > 0
const MAX_AUTO_DRAFTS_PER_RUN = 2 // reply drafts written per sync pass
const DEBOUNCE_MS = 3 * 60_000

interface SummaryOut {
  index: number
  tldr: string
  category: string
  participants?: string[]
  deadlines?: Deadline[]
  actionRequired?: boolean
  tasks?: string[]
  suggestReply?: boolean
}

export function todayIn(timezone: string): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())
}

/**
 * One sync pass across EVERY connected mail account (Gmail and IMAP):
 *  1. Pull new messages into Supabase (metadata only). An account's very first
 *     sync backfills the last 30 days (up to 100 mails); later syncs look at
 *     the last 3 days. Each account debounces independently.
 *  2. Summarize a bounded number of pending emails (any account).
 *  3. Auto-draft replies (in each account owner's voice) for reply-worthy
 *     mail — drafts are stored, NEVER sent.
 *  4. Renew Gmail push watches nearing expiry.
 * Bounded per invocation; call again while `pending` > 0. LLM failures leave
 * emails pending — never crash the sync.
 */
export async function runSync(
  opts: { force?: boolean; debounceMs?: number; accountId?: string } = {},
): Promise<SyncResult> {
  const all = await accounts.listAccounts()
  const targets = opts.accountId ? all.filter((a) => a.id === opts.accountId) : all
  const debounce = opts.debounceMs ?? DEBOUNCE_MS

  let newEmails = 0
  let anyFetched = false
  for (const acc of targets) {
    const firstEver = acc.lastSyncAt === null
    const fresh = acc.lastSyncAt !== null && Date.now() - Date.parse(acc.lastSyncAt) < debounce
    if (fresh && !opts.force) continue
    anyFetched = true
    try {
      const sinceDays = firstEver ? 30 : 3
      const known = await store.knownProviderIds(
        acc.id,
        new Date(Date.now() - (sinceDays + 1) * 86400_000).toISOString(),
      )
      const metas = await mailbox.fetchNewMetas(acc, {
        sinceDays,
        max: firstEver ? 100 : 50,
        known,
      })
      // Persist in chunks so progress survives even if the invocation dies.
      for (let i = 0; i < metas.length; i += 20) {
        newEmails += await store.upsertEmailMetas(acc.id, metas.slice(i, i + 20))
      }
      await accounts.touchAccountSync(acc.id)
    } catch (e) {
      console.error(`sync failed for account ${acc.email} (continuing with others)`, e)
    }
  }

  const accById = new Map(all.map((a) => [a.id, a]))
  let summarized = 0
  const settings = await store.getSettings()
  const validKeys = new Set(settings.categories.map((c) => c.key))
  const today = todayIn(settings.timezone)

  for (let b = 0; b < MAX_BATCHES_PER_RUN; b++) {
    const pendingRows = await store.listUnsummarized(BATCH_SIZE)
    if (pendingRows.length === 0) break

    const inputs: SummarizeInput[] = []
    for (const row of pendingRows) {
      let body = row.snippet
      const acc = accById.get(row.accountId)
      if (acc) {
        try {
          body = await mailbox.getBody(acc, store.providerIdOf(row))
        } catch (e) {
          console.error('body fetch failed, using snippet', row.id, e)
        }
      }
      inputs.push({
        index: inputs.length,
        from: `${row.fromName} <${row.fromEmail}>`,
        subject: row.subject,
        date: row.receivedAt,
        body: (body || row.subject).slice(0, 3500),
      })
    }

    try {
      const out = await llmJson<{ results: SummaryOut[] } | SummaryOut[]>(
        summarizeBatchPrompt(inputs, settings.categories, today),
        // Keep reserved tokens small: Groq's free tier admits requests against
        // a 12k tokens/min budget that includes max_tokens.
        { maxTokens: 1200 },
      )
      const results = Array.isArray(out) ? out : (out.results ?? [])
      for (const r of results) {
        const row = pendingRows[r.index]
        if (!row) continue
        await store.saveSummary(row.id, {
          tldr: String(r.tldr ?? '').slice(0, 300),
          category: validKeys.has(r.category) ? r.category : 'system',
          participants: (r.participants ?? []).map(String).slice(0, 10),
          deadlines: (r.deadlines ?? []).slice(0, 10),
          actionRequired: Boolean(r.actionRequired),
          tasks: (r.tasks ?? []).map(String).slice(0, 10),
          suggestReply: Boolean(r.suggestReply),
        })
        summarized++
      }
    } catch (e) {
      // Rate limit or provider hiccup: stop here, emails stay pending and the
      // next sync (push, frontend poll, or hourly cron) picks them up.
      console.error('summarization batch failed (will retry next sync)', e)
      break
    }
  }

  const drafted = await autoDraftReplies(accById)
  if (anyFetched) await renewWatchesIfDue(all)

  const pending = await store.countUnsummarized()
  return { skipped: !anyFetched && !opts.force, newEmails, summarized, drafted, pending }
}

/** Pre-writes replies (per-account voice) for reply-worthy mail. Never sends. */
async function autoDraftReplies(accById: Map<string, accounts.Account>): Promise<number> {
  let drafted = 0
  try {
    const candidates = await store.listNeedingDrafts(MAX_AUTO_DRAFTS_PER_RUN)
    for (const email of candidates) {
      const acc = accById.get(email.accountId)
      if (!acc) continue
      try {
        // Stored style only — building profiles belongs to /api/style/refresh
        // and the user-facing draft endpoints. Null style still drafts well.
        const stored = await store.getStyle(acc.id)
        let body = email.snippet
        try {
          body = await mailbox.getBody(acc, store.providerIdOf(email))
        } catch {
          /* snippet fallback */
        }
        const draft = await llmJson<{ subject: string; body: string }>(
          replyPrompt({
            fromName: email.fromName,
            fromEmail: email.fromEmail,
            subject: email.subject,
            date: email.receivedAt,
            body: (body || email.subject).slice(0, 6000),
            style: stored?.profile ?? null,
            examples: stored?.examples ?? [],
          }),
          { maxTokens: 900 },
        )
        if (typeof draft.subject === 'string' && typeof draft.body === 'string' && draft.body.trim()) {
          await store.saveDraft(email.id, draft.subject, draft.body)
          drafted++
        }
      } catch (e) {
        console.error('auto-draft failed (will retry next sync)', email.id, e)
        break // likely rate-limited — stop drafting this run
      }
    }
  } catch (e) {
    console.error('auto-draft pass failed', e)
  }
  return drafted
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
