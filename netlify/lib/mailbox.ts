// Provider facade: everything above this layer speaks "account + providerId"
// and never cares whether a mailbox is Gmail (API) or IMAP/SMTP.
import type { Account } from './accounts'
import * as gmail from './gmail'
import * as imap from './imap'

export interface MailMeta {
  providerId: string
  threadId: string
  fromName: string
  fromEmail: string
  toEmails: string[]
  subject: string
  snippet: string
  receivedAt: string
  messageIdHeader: string | null
}

const META_CHUNK = 5

/** New messages (metadata only) from a folder, skipping known provider ids. */
export async function fetchNewMetas(
  acc: Account,
  opts: { sinceDays: number; max: number; known: Set<string>; folder?: 'inbox' | 'sent' },
): Promise<MailMeta[]> {
  if (acc.kind === 'imap') {
    return imap.fetchRecentMetas(acc, opts)
  }
  const query =
    opts.folder === 'sent'
      ? `in:sent newer_than:${opts.sinceDays}d`
      : `in:inbox -in:chats newer_than:${opts.sinceDays}d`
  const ids = await gmail.listInboxIds(acc, query, opts.max)
  // Hard per-invocation cap: deep history backfills continue across syncs
  // instead of risking one long invocation.
  const fresh = ids.filter((m) => !opts.known.has(m.id)).slice(0, 100)
  const metas: MailMeta[] = []
  for (let i = 0; i < fresh.length; i += META_CHUNK) {
    const chunk = fresh.slice(i, i + META_CHUNK)
    const results = await Promise.all(
      chunk.map(async (m) => {
        try {
          const meta = await gmail.getMeta(acc, m.id)
          return { ...meta, providerId: meta.gmailId }
        } catch (e) {
          console.error('meta fetch failed', m.id, e)
          return null
        }
      }),
    )
    for (const r of results) if (r) metas.push(r)
  }
  return metas
}

/**
 * History dig: one batch of messages OLDER than the oldest stored one.
 * Returns [] when the mailbox's beginning has been reached.
 */
export async function fetchOlderMetas(
  acc: Account,
  opts: {
    folder: 'inbox' | 'sent'
    oldest: { receivedAt: string; providerId: string }
    known: Set<string>
  },
): Promise<MailMeta[]> {
  if (acc.kind === 'imap') {
    const metas = await imap.fetchOlderMetas(acc, {
      folder: opts.folder,
      beforeProviderId: opts.oldest.providerId,
      max: 100,
    })
    return metas.filter((m) => !opts.known.has(m.providerId))
  }
  // Gmail: search strictly before the oldest stored day (inclusive overlap is
  // deduped via `known` + idempotent upserts).
  const d = new Date(opts.oldest.receivedAt)
  const before = `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate() + 1}`
  const base = opts.folder === 'sent' ? 'in:sent' : 'in:inbox -in:chats'
  const ids = await gmail.listInboxIds(acc, `${base} before:${before}`, 150)
  const fresh = ids.filter((m) => !opts.known.has(m.id)).slice(0, 100)
  const metas: MailMeta[] = []
  for (let i = 0; i < fresh.length; i += META_CHUNK) {
    const chunk = fresh.slice(i, i + META_CHUNK)
    const results = await Promise.all(
      chunk.map(async (m) => {
        try {
          const meta = await gmail.getMeta(acc, m.id)
          return { ...meta, providerId: meta.gmailId }
        } catch (e) {
          console.error('older meta fetch failed', m.id, e)
          return null
        }
      }),
    )
    for (const r of results) if (r) metas.push(r)
  }
  return metas
}

/** Live body fetch — bodies are never persisted, for any provider. */
export async function getBody(acc: Account, providerId: string): Promise<string> {
  return acc.kind === 'imap' ? imap.fetchBody(acc, providerId) : gmail.getBody(acc, providerId)
}

/** Live body fetch with the original HTML preserved for rich rendering. */
export async function getBodyRich(
  acc: Account,
  providerId: string,
): Promise<{ text: string; html: string | null }> {
  return acc.kind === 'imap'
    ? imap.fetchBodyRich(acc, providerId)
    : gmail.getBodyRich(acc, providerId)
}

/**
 * Batched body text fetch — IMAP reuses ONE connection for the whole batch,
 * Gmail fetches in bounded parallel. Missing ids are simply absent.
 */
export async function getBodies(
  acc: Account,
  providerIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (providerIds.length === 0) return out
  if (acc.kind === 'imap') {
    const rich = await imap.fetchBodies(acc, providerIds)
    for (const [pid, b] of rich) out.set(pid, b.text)
    return out
  }
  for (let i = 0; i < providerIds.length; i += META_CHUNK) {
    const chunk = providerIds.slice(i, i + META_CHUNK)
    const results = await Promise.all(
      chunk.map(async (pid) => {
        try {
          return [pid, await gmail.getBody(acc, pid)] as const
        } catch (e) {
          console.error('body fetch failed', pid, e)
          return null
        }
      }),
    )
    for (const r of results) if (r) out.set(r[0], r[1])
  }
  return out
}

/** Reply-threading info for one message (best effort; null when unavailable). */
export async function getThreading(
  acc: Account,
  providerId: string,
): Promise<{ inReplyTo: string | null; references: string | null; threadId: string | null }> {
  if (acc.kind === 'imap') {
    // We stored no Message-ID for IMAP rows; replies go unthreaded.
    return { inReplyTo: null, references: null, threadId: null }
  }
  const meta = await gmail.getMeta(acc, providerId)
  return { inReplyTo: meta.messageIdHeader, references: meta.messageIdHeader, threadId: meta.threadId }
}

export interface SendOpts {
  to: string
  cc?: string
  subject: string
  body: string
  html?: string
  inReplyTo?: string | null
  references?: string | null
  threadId?: string | null
}

/** Sends from the given account (Gmail API or the account's SMTP server). */
export async function sendFrom(acc: Account, opts: SendOpts): Promise<{ id: string }> {
  if (acc.kind === 'imap') {
    return imap.sendSmtp(acc, {
      to: opts.to,
      cc: opts.cc,
      subject: opts.subject,
      body: opts.body,
      html: opts.html,
      inReplyTo: opts.inReplyTo,
      references: opts.references,
    })
  }
  return gmail.sendMail(acc, opts)
}

/** Recent sent mail for style learning. */
export async function sentSamples(
  acc: Account,
): Promise<{ to: string; subject: string; body: string }[]> {
  return acc.kind === 'imap' ? imap.fetchSentSamples(acc) : gmail.listSentSamples(acc)
}
