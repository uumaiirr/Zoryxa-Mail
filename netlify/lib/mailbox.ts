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

/** New inbox messages (metadata only), skipping already-known provider ids. */
export async function fetchNewMetas(
  acc: Account,
  opts: { sinceDays: number; max: number; known: Set<string> },
): Promise<MailMeta[]> {
  if (acc.kind === 'imap') {
    return imap.fetchRecentMetas(acc, opts)
  }
  const ids = await gmail.listInboxIds(
    acc,
    `in:inbox -in:chats newer_than:${opts.sinceDays}d`,
    opts.max,
  )
  const fresh = ids.filter((m) => !opts.known.has(m.id))
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

/** Live body fetch — bodies are never persisted, for any provider. */
export async function getBody(acc: Account, providerId: string): Promise<string> {
  return acc.kind === 'imap' ? imap.fetchBody(acc, providerId) : gmail.getBody(acc, providerId)
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
