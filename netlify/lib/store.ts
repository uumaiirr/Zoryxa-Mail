import type {
  AppSettings,
  Deadline,
  DigestContent,
  DigestRecord,
  EmailSummary,
  StyleProfile,
} from '../../shared/types'
import { emailKey } from './accounts'
import { HttpError } from './http'
import type { MailMeta } from './mailbox'
import { DEFAULT_CATEGORIES } from './prompts'
import { db } from './supabase'

function check<T>(r: { data: T | null; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`Database error (${what}): ${r.error.message}`)
  return r.data as T
}

// ── emails ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToEmail(r: any): EmailSummary {
  return {
    id: r.id,
    accountId: r.account_id,
    folder: r.folder === 'sent' ? 'sent' : 'inbox',
    priority: r.priority ?? 'normal',
    analyzed: Boolean(r.analyzed),
    threadId: r.thread_id,
    fromName: r.from_name,
    fromEmail: r.from_email,
    toEmails: r.to_emails ?? [],
    subject: r.subject,
    snippet: r.snippet,
    receivedAt: r.received_at,
    category: r.category,
    tldr: r.tldr,
    participants: r.participants ?? [],
    deadlines: (r.deadlines ?? []) as Deadline[],
    actionRequired: r.action_required,
    tasks: (r.tasks ?? []) as string[],
    isRead: r.is_read,
    summarized: r.summarized,
    suggestReply: Boolean(r.suggest_reply),
    hasDraft: Boolean(r.draft_body),
  }
}

/** providerId is needed for live body fetches; not exposed to the client. */
export function providerIdOf(e: EmailSummary): string {
  return e.id.slice(e.accountId.length + 1)
}

export async function upsertEmailMetas(
  accountId: string,
  userId: string,
  metas: MailMeta[],
  folder: 'inbox' | 'sent' = 'inbox',
): Promise<number> {
  if (metas.length === 0) return 0
  const rows = metas.map((m) => ({
    id: emailKey(accountId, m.providerId),
    account_id: accountId,
    user_id: userId,
    folder,
    // Sent mail is browsable history — it skips the AI pipeline entirely.
    ...(folder === 'sent' ? { summarized: true, category: 'sent' } : {}),
    provider_id: m.providerId,
    thread_id: m.threadId,
    from_name: m.fromName,
    from_email: m.fromEmail,
    to_emails: m.toEmails,
    subject: m.subject,
    snippet: m.snippet,
    received_at: m.receivedAt,
  }))
  const res = await db()
    .from('emails')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
    .select('id')
  return check(res, 'upsertEmailMetas')?.length ?? 0
}

/** Provider ids already stored for an account+folder since `sinceIso`. */
export async function knownProviderIds(
  accountId: string,
  sinceIso: string,
  folder: 'inbox' | 'sent' = 'inbox',
): Promise<Set<string>> {
  const res = await db()
    .from('emails')
    .select('provider_id')
    .eq('account_id', accountId)
    .eq('folder', folder)
    .gte('received_at', sinceIso)
    .limit(2000)
  return new Set(check(res, 'knownProviderIds').map((r: { provider_id: string }) => r.provider_id))
}

export async function listEmails(opts: {
  userId: string
  folder?: 'inbox' | 'sent'
  category?: string
  account?: string
  limit?: number
  before?: string
  /** Only emails with an AI reply draft waiting (the Drafts view). */
  drafts?: boolean
  /** Filter to one priority bucket; 'spam' is hidden from the inbox otherwise. */
  priority?: 'high' | 'normal' | 'low' | 'spam'
}): Promise<EmailSummary[]> {
  let q = db()
    .from('emails')
    .select('*')
    .eq('user_id', opts.userId)
    .eq('folder', opts.folder ?? 'inbox')
    .order('received_at', { ascending: false })
    .limit(Math.min(opts.limit ?? 50, 100))
  if (opts.drafts) q = q.not('draft_body', 'is', null)
  if (opts.priority) q = q.eq('priority', opts.priority)
  else if (!opts.drafts && (opts.folder ?? 'inbox') === 'inbox') q = q.neq('priority', 'spam')
  if (opts.category) q = q.eq('category', opts.category)
  if (opts.account) q = q.eq('account_id', opts.account)
  if (opts.before) q = q.lt('received_at', opts.before)
  return check(await q, 'listEmails').map(rowToEmail)
}

export async function getEmail(id: string): Promise<EmailSummary | null> {
  const res = await db().from('emails').select('*').eq('id', id).maybeSingle()
  const row = check(res, 'getEmail')
  return row ? rowToEmail(row) : null
}

/** An email the signed-in user owns — 404s otherwise. */
export async function getUserEmail(id: string, userId: string): Promise<EmailSummary> {
  const res = await db()
    .from('emails')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  const row = check(res, 'getUserEmail')
  if (!row) throw new HttpError(404, 'Email not found')
  return rowToEmail(row)
}

export async function markRead(id: string): Promise<void> {
  check(await db().from('emails').update({ is_read: true }).eq('id', id), 'markRead')
}

export async function listUnsummarized(limit: number): Promise<EmailSummary[]> {
  const res = await db()
    .from('emails')
    .select('*')
    .eq('summarized', false)
    .eq('folder', 'inbox')
    .order('received_at', { ascending: false })
    .limit(limit)
  return check(res, 'listUnsummarized').map(rowToEmail)
}

export async function countUnsummarized(): Promise<number> {
  const { count, error } = await db()
    .from('emails')
    .select('id', { count: 'exact', head: true })
    .eq('summarized', false)
    .eq('folder', 'inbox')
  if (error) throw new Error(`Database error (countUnsummarized): ${error.message}`)
  return count ?? 0
}

/** Emails whose preview text hasn't been pulled yet (snippet is empty). */
export async function listNeedingSnippet(limit: number): Promise<EmailSummary[]> {
  const res = await db()
    .from('emails')
    .select('*')
    .eq('snippet', '')
    .eq('folder', 'inbox')
    .order('received_at', { ascending: false })
    .limit(limit)
  return check(res, 'listNeedingSnippet').map(rowToEmail)
}

export async function saveSnippet(id: string, snippet: string): Promise<void> {
  check(await db().from('emails').update({ snippet }).eq('id', id), 'saveSnippet')
}

export interface TriageInput {
  category: string
  priority: 'high' | 'normal' | 'low' | 'spam'
  actionRequired: boolean
  suggestReply: boolean
}

/** Cheap sort pass: category + priority, no body, no summary yet. */
export async function saveTriage(id: string, t: TriageInput): Promise<void> {
  check(
    await db()
      .from('emails')
      .update({
        category: t.category,
        priority: t.priority,
        action_required: t.actionRequired,
        suggest_reply: t.suggestReply,
        summarized: true, // triaged — the card can render normally now
      })
      .eq('id', id),
    'saveTriage',
  )
}

/** Deep analysis, produced when the CEO opens an email. */
export async function saveAnalysis(
  id: string,
  a: {
    tldr: string
    participants: string[]
    deadlines: Deadline[]
    actionRequired: boolean
    tasks: string[]
    draft: { subject: string; body: string } | null
  },
): Promise<void> {
  check(
    await db()
      .from('emails')
      .update({
        tldr: a.tldr,
        participants: a.participants,
        deadlines: a.deadlines,
        action_required: a.actionRequired,
        tasks: a.tasks,
        analyzed: true,
        summarized: true,
        ...(a.draft
          ? {
              draft_subject: a.draft.subject,
              draft_body: a.draft.body,
              draft_generated_at: new Date().toISOString(),
            }
          : {}),
      })
      .eq('id', id),
    'saveAnalysis',
  )
}

export interface SummaryInput {
  tldr: string
  category: string
  participants: string[]
  deadlines: Deadline[]
  actionRequired: boolean
  tasks: string[]
  suggestReply: boolean
}

export async function saveSummary(id: string, s: SummaryInput): Promise<void> {
  check(
    await db()
      .from('emails')
      .update({
        tldr: s.tldr,
        category: s.category,
        participants: s.participants,
        deadlines: s.deadlines,
        action_required: s.actionRequired,
        tasks: s.tasks,
        suggest_reply: s.suggestReply,
        summarized: true,
      })
      .eq('id', id),
    'saveSummary',
  )
}

/** Reply-worthy RECENT emails that don't have an auto-draft yet (history
 *  backfill must never burn AI quota drafting replies to ancient threads). */
export async function listNeedingDrafts(limit: number): Promise<EmailSummary[]> {
  const res = await db()
    .from('emails')
    .select('*')
    .eq('summarized', true)
    .eq('suggest_reply', true)
    .eq('folder', 'inbox')
    .is('draft_body', null)
    .gte('received_at', new Date(Date.now() - 7 * 86400_000).toISOString())
    .order('received_at', { ascending: false })
    .limit(limit)
  return check(res, 'listNeedingDrafts').map(rowToEmail)
}

/** The oldest stored email of an account+folder — the history-dig watermark. */
export async function oldestEmail(
  accountId: string,
  folder: 'inbox' | 'sent',
): Promise<{ receivedAt: string; providerId: string } | null> {
  const res = await db()
    .from('emails')
    .select('received_at, provider_id')
    .eq('account_id', accountId)
    .eq('folder', folder)
    .order('received_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  const row = check(res, 'oldestEmail')
  return row ? { receivedAt: row.received_at, providerId: row.provider_id } : null
}

export async function saveDraft(id: string, subject: string, body: string): Promise<void> {
  check(
    await db()
      .from('emails')
      .update({
        draft_subject: subject,
        draft_body: body,
        draft_generated_at: new Date().toISOString(),
      })
      .eq('id', id),
    'saveDraft',
  )
}

export async function getDraft(id: string): Promise<{ subject: string; body: string } | null> {
  const res = await db()
    .from('emails')
    .select('draft_subject, draft_body')
    .eq('id', id)
    .maybeSingle()
  const row = check(res, 'getDraft')
  if (!row?.draft_body) return null
  return { subject: row.draft_subject ?? '', body: row.draft_body }
}

export async function emailsSince(userId: string, iso: string): Promise<EmailSummary[]> {
  const res = await db()
    .from('emails')
    .select('*')
    .eq('user_id', userId)
    .eq('folder', 'inbox')
    .gte('received_at', iso)
    .order('received_at', { ascending: false })
    .limit(200)
  return check(res, 'emailsSince').map(rowToEmail)
}

// ── settings (per user) ───────────────────────────────────────────────────────

function defaultSettings(): AppSettings {
  return {
    categories: DEFAULT_CATEGORIES,
    digestHour: 7,
    timezone: 'Asia/Dubai',
    digestTo: '', // empty = the user's own sign-in email
    llmProvider: process.env.LLM_PROVIDER === 'groq' ? 'groq' : 'gemini',
    historyDays: 90,
  }
}

/** Other messages in the same conversation — the reply trace. */
export async function threadEmails(
  userId: string,
  threadId: string,
  accountId: string,
): Promise<EmailSummary[]> {
  const res = await db()
    .from('emails')
    .select('*')
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .eq('thread_id', threadId)
    .order('received_at', { ascending: true })
    .limit(30)
  return check(res, 'threadEmails').map(rowToEmail)
}

export async function getSettings(userId: string): Promise<AppSettings> {
  const res = await db().from('user_settings').select('value').eq('user_id', userId).maybeSingle()
  const row = check(res, 'getSettings')
  return { ...defaultSettings(), ...((row?.value ?? {}) as Partial<AppSettings>) }
}

export async function saveSettings(userId: string, s: AppSettings): Promise<void> {
  check(
    await db()
      .from('user_settings')
      .upsert({ user_id: userId, value: s, updated_at: new Date().toISOString() }),
    'saveSettings',
  )
}

// ── style profiles (one per account) ─────────────────────────────────────────

export async function getStyle(accountId: string): Promise<{
  profile: StyleProfile
  examples: string[]
  updatedAt: string
} | null> {
  const res = await db()
    .from('style_profile')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle()
  const row = check(res, 'getStyle')
  if (!row || !row.profile) return null
  return {
    profile: row.profile as StyleProfile,
    examples: (row.examples ?? []) as string[],
    updatedAt: row.updated_at,
  }
}

export async function saveStyle(
  accountId: string,
  profile: StyleProfile,
  examples: string[],
): Promise<void> {
  check(
    await db()
      .from('style_profile')
      .upsert({ account_id: accountId, profile, examples, updated_at: new Date().toISOString() }),
    'saveStyle',
  )
}

// ── digests ───────────────────────────────────────────────────────────────────

export async function getDigest(userId: string, date: string): Promise<DigestRecord | null> {
  const res = await db()
    .from('digests')
    .select('*')
    .eq('user_id', userId)
    .eq('digest_date', date)
    .maybeSingle()
  const row = check(res, 'getDigest')
  if (!row) return null
  return { date: row.digest_date, content: row.content as DigestContent, emailedAt: row.emailed_at }
}

export async function saveDigest(
  userId: string,
  date: string,
  content: DigestContent,
  emailedAt: string | null,
): Promise<void> {
  check(
    await db()
      .from('digests')
      .upsert({ user_id: userId, digest_date: date, content, emailed_at: emailedAt }),
    'saveDigest',
  )
}
