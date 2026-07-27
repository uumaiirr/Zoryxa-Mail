import type {
  AppSettings,
  Deadline,
  DigestContent,
  DigestRecord,
  EmailSummary,
  StyleProfile,
} from '../../shared/types'
import { decrypt, encrypt } from './crypto'
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
    gmailId: r.gmail_id,
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
    hasDraft: Boolean(r.draft_body),
  }
}

export interface EmailMetaInput {
  gmailId: string
  threadId: string
  fromName: string
  fromEmail: string
  toEmails: string[]
  subject: string
  snippet: string
  receivedAt: string
}

export async function upsertEmailMetas(metas: EmailMetaInput[]): Promise<number> {
  if (metas.length === 0) return 0
  const rows = metas.map((m) => ({
    gmail_id: m.gmailId,
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
    .upsert(rows, { onConflict: 'gmail_id', ignoreDuplicates: true })
    .select('gmail_id')
  return check(res, 'upsertEmailMetas')?.length ?? 0
}

export async function existingGmailIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const res = await db().from('emails').select('gmail_id').in('gmail_id', ids)
  return new Set(check(res, 'existingGmailIds').map((r: { gmail_id: string }) => r.gmail_id))
}

export async function listEmails(opts: {
  category?: string
  limit?: number
  before?: string
}): Promise<EmailSummary[]> {
  let q = db()
    .from('emails')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(Math.min(opts.limit ?? 50, 100))
  if (opts.category) q = q.eq('category', opts.category)
  if (opts.before) q = q.lt('received_at', opts.before)
  return check(await q, 'listEmails').map(rowToEmail)
}

export async function getEmail(gmailId: string): Promise<EmailSummary | null> {
  const res = await db().from('emails').select('*').eq('gmail_id', gmailId).maybeSingle()
  const row = check(res, 'getEmail')
  return row ? rowToEmail(row) : null
}

export async function markRead(gmailId: string): Promise<void> {
  check(await db().from('emails').update({ is_read: true }).eq('gmail_id', gmailId), 'markRead')
}

export async function listUnsummarized(limit: number): Promise<EmailSummary[]> {
  const res = await db()
    .from('emails')
    .select('*')
    .eq('summarized', false)
    .order('received_at', { ascending: false })
    .limit(limit)
  return check(res, 'listUnsummarized').map(rowToEmail)
}

export async function countUnsummarized(): Promise<number> {
  const { count, error } = await db()
    .from('emails')
    .select('gmail_id', { count: 'exact', head: true })
    .eq('summarized', false)
  if (error) throw new Error(`Database error (countUnsummarized): ${error.message}`)
  return count ?? 0
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

export async function saveSummary(gmailId: string, s: SummaryInput): Promise<void> {
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
      .eq('gmail_id', gmailId),
    'saveSummary',
  )
}

/** Reply-worthy, summarized emails that don't have an auto-draft yet. */
export async function listNeedingDrafts(limit: number): Promise<EmailSummary[]> {
  const res = await db()
    .from('emails')
    .select('*')
    .eq('summarized', true)
    .eq('suggest_reply', true)
    .is('draft_body', null)
    .order('received_at', { ascending: false })
    .limit(limit)
  return check(res, 'listNeedingDrafts').map(rowToEmail)
}

export async function saveDraft(gmailId: string, subject: string, body: string): Promise<void> {
  check(
    await db()
      .from('emails')
      .update({
        draft_subject: subject,
        draft_body: body,
        draft_generated_at: new Date().toISOString(),
      })
      .eq('gmail_id', gmailId),
    'saveDraft',
  )
}

export async function getDraft(
  gmailId: string,
): Promise<{ subject: string; body: string } | null> {
  const res = await db()
    .from('emails')
    .select('draft_subject, draft_body')
    .eq('gmail_id', gmailId)
    .maybeSingle()
  const row = check(res, 'getDraft')
  if (!row?.draft_body) return null
  return { subject: row.draft_subject ?? '', body: row.draft_body }
}

export async function emailsSince(iso: string): Promise<EmailSummary[]> {
  const res = await db()
    .from('emails')
    .select('*')
    .gte('received_at', iso)
    .order('received_at', { ascending: false })
    .limit(200)
  return check(res, 'emailsSince').map(rowToEmail)
}

// ── settings ──────────────────────────────────────────────────────────────────

function defaultSettings(): AppSettings {
  return {
    categories: DEFAULT_CATEGORIES,
    digestHour: 7,
    timezone: 'Asia/Dubai',
    digestTo: process.env.DIGEST_TO ?? '',
    sendAs: process.env.SEND_AS ?? '',
    llmProvider: process.env.LLM_PROVIDER === 'groq' ? 'groq' : 'gemini',
  }
}

export async function getSettings(): Promise<AppSettings> {
  const res = await db().from('app_settings').select('value').eq('key', 'app').maybeSingle()
  const row = check(res, 'getSettings')
  return { ...defaultSettings(), ...((row?.value ?? {}) as Partial<AppSettings>) }
}

export async function saveSettings(s: AppSettings): Promise<void> {
  check(
    await db()
      .from('app_settings')
      .upsert({ key: 'app', value: s, updated_at: new Date().toISOString() }),
    'saveSettings',
  )
}

// ── style profile ─────────────────────────────────────────────────────────────

export async function getStyle(): Promise<{
  profile: StyleProfile
  examples: string[]
  updatedAt: string
} | null> {
  const res = await db().from('style_profile').select('*').eq('id', 1).maybeSingle()
  const row = check(res, 'getStyle')
  if (!row || !row.profile) return null
  return {
    profile: row.profile as StyleProfile,
    examples: (row.examples ?? []) as string[],
    updatedAt: row.updated_at,
  }
}

export async function saveStyle(profile: StyleProfile, examples: string[]): Promise<void> {
  check(
    await db()
      .from('style_profile')
      .upsert({ id: 1, profile, examples, updated_at: new Date().toISOString() }),
    'saveStyle',
  )
}

// ── digests ───────────────────────────────────────────────────────────────────

export async function getDigest(date: string): Promise<DigestRecord | null> {
  const res = await db().from('digests').select('*').eq('digest_date', date).maybeSingle()
  const row = check(res, 'getDigest')
  if (!row) return null
  return { date: row.digest_date, content: row.content as DigestContent, emailedAt: row.emailed_at }
}

export async function saveDigest(
  date: string,
  content: DigestContent,
  emailedAt: string | null,
): Promise<void> {
  check(
    await db()
      .from('digests')
      .upsert({ digest_date: date, content, emailed_at: emailedAt }),
    'saveDigest',
  )
}

// ── oauth tokens (encrypted at rest) ─────────────────────────────────────────

export async function getRefreshToken(): Promise<{ token: string; email: string | null } | null> {
  const res = await db().from('oauth_tokens').select('*').eq('id', 1).maybeSingle()
  const row = check(res, 'getRefreshToken')
  if (!row) return null
  return { token: decrypt(row.refresh_token_enc), email: row.granted_email }
}

export async function saveRefreshToken(token: string, email: string): Promise<void> {
  check(
    await db()
      .from('oauth_tokens')
      .upsert({
        id: 1,
        refresh_token_enc: encrypt(token),
        granted_email: email,
        updated_at: new Date().toISOString(),
      }),
    'saveRefreshToken',
  )
}

// ── sync state ────────────────────────────────────────────────────────────────

export async function getSyncState(): Promise<{
  lastSyncAt: string | null
  watchExpiresAt: string | null
}> {
  const res = await db().from('sync_state').select('*').eq('id', 1).maybeSingle()
  const row = check(res, 'getSyncState')
  return {
    lastSyncAt: row?.last_sync_at ?? null,
    watchExpiresAt: row?.watch_expires_at ?? null,
  }
}

export async function touchSyncState(): Promise<void> {
  check(
    await db().from('sync_state').upsert({ id: 1, last_sync_at: new Date().toISOString() }),
    'touchSyncState',
  )
}

export async function saveWatchExpiry(iso: string): Promise<void> {
  const existing = await getSyncState()
  check(
    await db()
      .from('sync_state')
      .upsert({ id: 1, last_sync_at: existing.lastSyncAt, watch_expires_at: iso }),
    'saveWatchExpiry',
  )
}
