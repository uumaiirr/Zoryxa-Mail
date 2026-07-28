import type { ImapAccountInput, MailAccount } from '../../shared/types'
import { decrypt, encrypt } from './crypto'
import { HttpError } from './http'
import { db } from './supabase'

/** Server-side account record. Secrets stay encrypted until the moment of use. */
export interface Account {
  id: string
  userId: string
  kind: 'gmail' | 'imap'
  label: string
  email: string
  sendAs: string
  refreshTokenEnc: string | null
  watchExpiresAt: string | null
  imapHost: string | null
  imapPort: number | null
  imapUser: string | null
  imapPassEnc: string | null
  smtpHost: string | null
  smtpPort: number | null
  smtpUser: string | null
  smtpPassEnc: string | null
  lastSyncAt: string | null
}

function check<T>(r: { data: T | null; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`Database error (${what}): ${r.error.message}`)
  return r.data as T
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToAccount(r: any): Account {
  return {
    id: r.id,
    userId: r.user_id,
    kind: r.kind,
    label: r.label,
    email: r.email,
    sendAs: r.send_as,
    refreshTokenEnc: r.refresh_token_enc,
    watchExpiresAt: r.watch_expires_at,
    imapHost: r.imap_host,
    imapPort: r.imap_port,
    imapUser: r.imap_user,
    imapPassEnc: r.imap_pass_enc,
    smtpHost: r.smtp_host,
    smtpPort: r.smtp_port,
    smtpUser: r.smtp_user,
    smtpPassEnc: r.smtp_pass_enc,
    lastSyncAt: r.last_sync_at,
  }
}

export function toPublic(a: Account): MailAccount {
  return { id: a.id, kind: a.kind, label: a.label, email: a.email, sendAs: a.sendAs || a.email }
}

export function accountRefreshToken(a: Account): string {
  if (!a.refreshTokenEnc) throw new HttpError(409, `${a.email} is not connected — reconnect it in Settings`)
  return decrypt(a.refreshTokenEnc)
}

export function accountImapPass(a: Account): string {
  if (!a.imapPassEnc) throw new HttpError(409, `${a.email} has no stored mail password — re-add the account`)
  return decrypt(a.imapPassEnc)
}

export function accountSmtpPass(a: Account): string {
  if (!a.smtpPassEnc) throw new HttpError(409, `${a.email} has no stored sending password — re-add the account`)
  return decrypt(a.smtpPassEnc)
}

/** One user's connected mailboxes. */
export async function listAccounts(userId: string): Promise<Account[]> {
  const res = await db()
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  return check(res, 'listAccounts').map(rowToAccount)
}

/** Every account across all users — cron/sync paths only. */
export async function listAllAccounts(): Promise<Account[]> {
  const res = await db().from('accounts').select('*').order('created_at', { ascending: true })
  return check(res, 'listAllAccounts').map(rowToAccount)
}

export async function getAccount(id: string): Promise<Account | null> {
  const res = await db().from('accounts').select('*').eq('id', id).maybeSingle()
  const row = check(res, 'getAccount')
  return row ? rowToAccount(row) : null
}

/** An account the signed-in user owns — 404s otherwise. */
export async function getUserAccount(id: string, userId: string): Promise<Account> {
  const acc = await getAccount(id)
  if (!acc || acc.userId !== userId) throw new HttpError(404, 'Mail account not found')
  return acc
}

/** Connect (or refresh) a Gmail account for one user, keyed by its address. */
export async function upsertGmailAccount(
  userId: string,
  email: string,
  refreshToken: string,
): Promise<Account> {
  const existing = await db()
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('kind', 'gmail')
    .eq('email', email)
    .maybeSingle()
  const row = check(existing, 'upsertGmailAccount.find')
  if (row) {
    const res = await db()
      .from('accounts')
      .update({ refresh_token_enc: encrypt(refreshToken) })
      .eq('id', row.id)
      .select('*')
      .single()
    return rowToAccount(check(res, 'upsertGmailAccount.update'))
  }
  const res = await db()
    .from('accounts')
    .insert({
      user_id: userId,
      kind: 'gmail',
      label: email,
      email,
      send_as: '',
      refresh_token_enc: encrypt(refreshToken),
    })
    .select('*')
    .single()
  return rowToAccount(check(res, 'upsertGmailAccount.insert'))
}

/** Store a verified IMAP/SMTP account (verify credentials BEFORE calling). */
export async function createImapAccount(
  userId: string,
  input: ImapAccountInput,
): Promise<Account> {
  const res = await db()
    .from('accounts')
    .insert({
      user_id: userId,
      kind: 'imap',
      label: input.label || input.email,
      email: input.email,
      send_as: input.sendAs || input.email,
      imap_host: input.imapHost,
      imap_port: input.imapPort,
      imap_user: input.imapUser,
      imap_pass_enc: encrypt(input.imapPass),
      smtp_host: input.smtpHost,
      smtp_port: input.smtpPort,
      smtp_user: input.smtpUser,
      smtp_pass_enc: encrypt(input.smtpPass),
    })
    .select('*')
    .single()
  return rowToAccount(check(res, 'createImapAccount'))
}

/** Edit the user-facing bits of an account (display label, From alias). */
export async function updateAccount(
  id: string,
  patch: { label?: string; sendAs?: string },
): Promise<Account> {
  const update: Record<string, string> = {}
  if (patch.label !== undefined) update.label = patch.label
  if (patch.sendAs !== undefined) update.send_as = patch.sendAs
  const res = await db().from('accounts').update(update).eq('id', id).select('*').single()
  return rowToAccount(check(res, 'updateAccount'))
}

export async function deleteAccount(id: string): Promise<void> {
  // Emails and style profile cascade via FK.
  check(await db().from('accounts').delete().eq('id', id), 'deleteAccount')
}

export async function touchAccountSync(id: string): Promise<void> {
  check(
    await db().from('accounts').update({ last_sync_at: new Date().toISOString() }).eq('id', id),
    'touchAccountSync',
  )
}

export async function saveAccountWatch(id: string, expiresAt: string): Promise<void> {
  check(
    await db().from('accounts').update({ watch_expires_at: expiresAt }).eq('id', id),
    'saveAccountWatch',
  )
}

// ── opaque email ids ─────────────────────────────────────────────────────────
// Every stored email is addressed as `${accountId}~${providerId}` so the UI
// never needs to know which backend a message came from.

export function emailKey(accountId: string, providerId: string): string {
  return `${accountId}~${providerId}`
}

export function splitKey(id: string): { accountId: string; providerId: string } {
  const i = id.indexOf('~')
  if (i < 1) throw new HttpError(404, 'Email not found')
  return { accountId: id.slice(0, i), providerId: id.slice(i + 1) }
}
