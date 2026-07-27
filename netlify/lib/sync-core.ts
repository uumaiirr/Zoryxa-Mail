import type { Deadline, SyncResult } from '../../shared/types'
import { optionalEnv } from './env'
import * as gmail from './gmail'
import { llmJson } from './llm'
import { replyPrompt, summarizeBatchPrompt, type SummarizeInput } from './prompts'
import * as store from './store'

const BATCH_SIZE = 5 // emails per LLM call — small enough for free-tier TPM limits
const MAX_BATCHES_PER_RUN = 2 // callers re-invoke while `pending` > 0
const MAX_AUTO_DRAFTS_PER_RUN = 2 // reply drafts written per sync pass
const META_CHUNK = 5 // parallel Gmail meta fetches, persisted chunk-by-chunk
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
 * One sync pass:
 *  1. Pull new inbox messages into Supabase (metadata only). The very first
 *     sync backfills the last 30 days (up to 100 mails); later syncs look at
 *     the last 3 days.
 *  2. Summarize a bounded number of pending emails.
 *  3. Auto-draft replies (in the CEO's voice) for mail the model marked
 *     reply-worthy — drafts are stored, NEVER sent.
 *  4. Renew the Gmail push-notification watch when it nears expiry.
 * Designed to stay inside one function invocation and free LLM rate limits;
 * call again while `pending` > 0 to drain the queue. LLM failures leave
 * emails pending — never crash the sync.
 */
export async function runSync(
  opts: { force?: boolean; debounceMs?: number } = {},
): Promise<SyncResult> {
  const state = await store.getSyncState()
  const firstEver = state.lastSyncAt === null
  const debounce = opts.debounceMs ?? DEBOUNCE_MS
  const fresh = state.lastSyncAt !== null && Date.now() - Date.parse(state.lastSyncAt) < debounce

  let newEmails = 0
  if (!fresh || opts.force) {
    const query = firstEver ? 'in:inbox -in:chats newer_than:30d' : 'in:inbox -in:chats newer_than:3d'
    const ids = await gmail.listInboxIds(query, firstEver ? 100 : 50)
    const known = await store.existingGmailIds(ids.map((m) => m.id))
    const freshIds = ids.filter((x) => !known.has(x.id))
    // Fetch metas with bounded parallelism and persist chunk-by-chunk, so even
    // if the invocation is killed mid-backfill, progress survives and the next
    // run continues where this one stopped.
    for (let i = 0; i < freshIds.length; i += META_CHUNK) {
      const chunk = freshIds.slice(i, i + META_CHUNK)
      const metas = (
        await Promise.all(
          chunk.map(async (m) => {
            try {
              return await gmail.getMeta(m.id)
            } catch (e) {
              console.error('meta fetch failed', m.id, e)
              return null
            }
          }),
        )
      ).filter((m): m is gmail.MessageMeta => m !== null)
      newEmails += await store.upsertEmailMetas(metas)
    }
    await store.touchSyncState()
  }

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
      try {
        body = await gmail.getBody(row.gmailId)
      } catch (e) {
        console.error('body fetch failed, using snippet', row.gmailId, e)
      }
      inputs.push({
        index: inputs.length,
        from: `${row.fromName} <${row.fromEmail}>`,
        subject: row.subject,
        date: row.receivedAt,
        body: body.slice(0, 3500),
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
        await store.saveSummary(row.gmailId, {
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

  const drafted = await autoDraftReplies()
  await renewWatchIfDue(state.watchExpiresAt)

  const pending = await store.countUnsummarized()
  return { skipped: fresh && !opts.force, newEmails, summarized, drafted, pending }
}

/** Pre-writes replies (in the CEO's voice) for reply-worthy mail. Never sends. */
async function autoDraftReplies(): Promise<number> {
  let drafted = 0
  try {
    const candidates = await store.listNeedingDrafts(MAX_AUTO_DRAFTS_PER_RUN)
    if (candidates.length === 0) return 0
    // Use the stored style profile only — never trigger the expensive style
    // build from inside sync (it belongs to /api/style/refresh and the
    // user-facing draft endpoints). Drafting works fine with a null profile.
    const stored = await store.getStyle()
    const profile = stored?.profile ?? null
    const examples = stored?.examples ?? []
    for (const email of candidates) {
      try {
        let body = email.snippet
        try {
          body = await gmail.getBody(email.gmailId)
        } catch {
          /* snippet fallback */
        }
        const draft = await llmJson<{ subject: string; body: string }>(
          replyPrompt({
            fromName: email.fromName,
            fromEmail: email.fromEmail,
            subject: email.subject,
            date: email.receivedAt,
            body: body.slice(0, 6000),
            style: profile,
            examples,
          }),
          { maxTokens: 900 },
        )
        if (typeof draft.subject === 'string' && typeof draft.body === 'string' && draft.body.trim()) {
          await store.saveDraft(email.gmailId, draft.subject, draft.body)
          drafted++
        }
      } catch (e) {
        console.error('auto-draft failed (will retry next sync)', email.gmailId, e)
        break // likely rate-limited — stop drafting this run
      }
    }
  } catch (e) {
    console.error('auto-draft pass failed', e)
  }
  return drafted
}

/** Keeps real-time push alive: Gmail watches expire every ~7 days. */
async function renewWatchIfDue(watchExpiresAt: string | null): Promise<void> {
  const topic = optionalEnv('GMAIL_PUSH_TOPIC')
  if (!topic) return // push not configured — hourly cron + app-open sync still work
  const dueSoon =
    watchExpiresAt === null || Date.parse(watchExpiresAt) - Date.now() < 24 * 3600_000
  if (!dueSoon) return
  try {
    const { expiresAt } = await gmail.watchInbox(topic)
    await store.saveWatchExpiry(expiresAt)
  } catch (e) {
    console.error('gmail watch renewal failed (will retry next sync)', e)
  }
}
