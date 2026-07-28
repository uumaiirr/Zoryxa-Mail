import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import nodemailer from 'nodemailer'
import type { ImapAccountInput } from '../../shared/types'
import { accountImapPass, accountSmtpPass, type Account } from './accounts'
import { HttpError } from './http'

export interface ImapMeta {
  providerId: string // IMAP UID as string
  threadId: string
  fromName: string
  fromEmail: string
  toEmails: string[]
  subject: string
  snippet: string
  receivedAt: string
  messageIdHeader: string | null
}

function imapClient(host: string, port: number, user: string, pass: string): ImapFlow {
  return new ImapFlow({
    host,
    port,
    secure: port === 993,
    auth: { user, pass },
    logger: false,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
  })
}

function clientFor(acc: Account): ImapFlow {
  if (!acc.imapHost || !acc.imapPort || !acc.imapUser) {
    throw new HttpError(409, `${acc.email} is missing its mail server details — re-add the account`)
  }
  return imapClient(acc.imapHost, acc.imapPort, acc.imapUser, accountImapPass(acc))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addr(a: any): { name: string; email: string } {
  return { name: a?.name || a?.address || '', email: a?.address || '' }
}

/** Recent inbox envelopes, newest last; `known` UIDs are skipped. */
export async function fetchRecentMetas(
  acc: Account,
  opts: { sinceDays: number; max: number; known: Set<string> },
): Promise<ImapMeta[]> {
  const client = clientFor(acc)
  const metas: ImapMeta[] = []
  await client.connect()
  try {
    const lock = await client.getMailboxLock('INBOX')
    try {
      const since = new Date(Date.now() - opts.sinceDays * 86400_000)
      const uids = (await client.search({ since }, { uid: true })) || []
      const fresh = uids.filter((u) => !opts.known.has(String(u))).slice(-opts.max)
      if (fresh.length > 0) {
        for await (const msg of client.fetch(
          fresh,
          { envelope: true, internalDate: true, uid: true },
          { uid: true },
        )) {
          const env = msg.envelope
          if (!env) continue
          const from = addr(env.from?.[0])
          const toEmails = [...(env.to ?? []), ...(env.cc ?? [])]
            .map((a) => addr(a).email)
            .filter(Boolean)
            .slice(0, 10)
          metas.push({
            providerId: String(msg.uid),
            threadId: String(msg.uid), // IMAP has no cheap thread id; message stands alone
            fromName: from.name || from.email,
            fromEmail: from.email,
            toEmails,
            subject: env.subject || '(no subject)',
            snippet: '', // filled by the first summarize pass via fetchBody
            receivedAt: new Date(msg.internalDate ?? Date.now()).toISOString(),
            messageIdHeader: env.messageId ?? null,
          })
        }
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }
  return metas
}

function stripHtml(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Downloads and parses one message body (never persisted). */
export async function fetchBody(acc: Account, uid: string): Promise<string> {
  const client = clientFor(acc)
  await client.connect()
  try {
    const lock = await client.getMailboxLock('INBOX')
    try {
      const msg = await client.fetchOne(uid, { source: true }, { uid: true })
      if (!msg || !msg.source) throw new HttpError(404, 'Email not found on the mail server')
      const parsed = await simpleParser(msg.source)
      const text = (parsed.text || '').trim() || stripHtml(String(parsed.html || ''))
      return text.slice(0, 20000)
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }
}

/** Recent messages from the Sent mailbox (for style learning). [] if none found. */
export async function fetchSentSamples(
  acc: Account,
  max = 12,
): Promise<{ to: string; subject: string; body: string }[]> {
  const client = clientFor(acc)
  const samples: { to: string; subject: string; body: string }[] = []
  await client.connect()
  try {
    const boxes = await client.list()
    const sent =
      boxes.find((b) => b.specialUse === '\\Sent') ??
      boxes.find((b) => /^(sent|sent items|sent messages|INBOX\.Sent)$/i.test(b.path))
    if (!sent) return []
    const lock = await client.getMailboxLock(sent.path)
    try {
      const uids = (await client.search({ since: new Date(Date.now() - 90 * 86400_000) }, { uid: true })) || []
      for (const uid of uids.slice(-max).reverse()) {
        try {
          const msg = await client.fetchOne(String(uid), { source: true, envelope: true }, { uid: true })
          if (!msg || !msg.source) continue
          const parsed = await simpleParser(msg.source)
          const body = ((parsed.text || '').trim() || stripHtml(String(parsed.html || ''))).slice(0, 1500)
          if (body.length < 40) continue
          const to = [...(msg.envelope?.to ?? [])].map((a) => addr(a).email).filter(Boolean).join(', ')
          samples.push({ to, subject: msg.envelope?.subject || '', body })
        } catch (e) {
          console.error('imap sent sample failed', uid, e)
        }
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }
  return samples
}

/** Sends via the account's SMTP server. */
export async function sendSmtp(
  acc: Account,
  opts: {
    to: string
    cc?: string
    subject: string
    body: string
    html?: string
    inReplyTo?: string | null
    references?: string | null
  },
): Promise<{ id: string }> {
  if (!acc.smtpHost || !acc.smtpPort || !acc.smtpUser) {
    throw new HttpError(409, `${acc.email} is missing its sending (SMTP) details — re-add the account`)
  }
  const transporter = nodemailer.createTransport({
    host: acc.smtpHost,
    port: acc.smtpPort,
    secure: acc.smtpPort === 465,
    auth: { user: acc.smtpUser, pass: accountSmtpPass(acc) },
    connectionTimeout: 15000,
  })
  const info = await transporter.sendMail({
    from: acc.sendAs || acc.email,
    to: opts.to,
    cc: opts.cc || undefined,
    subject: opts.subject,
    text: opts.body,
    html: opts.html || undefined,
    inReplyTo: opts.inReplyTo || undefined,
    references: opts.references || undefined,
  })
  return { id: info.messageId ?? 'sent' }
}

/** Verifies IMAP + SMTP credentials before an account is stored. */
export async function verifyImapAccount(input: ImapAccountInput): Promise<void> {
  const client = imapClient(input.imapHost, input.imapPort, input.imapUser, input.imapPass)
  try {
    await client.connect()
    await client.logout().catch(() => {})
  } catch (e) {
    throw new HttpError(
      400,
      `Could not sign in to the mail server (${input.imapHost}): check the server, port, username, and password. (${e instanceof Error ? e.message.slice(0, 120) : 'connection failed'})`,
    )
  }
  const transporter = nodemailer.createTransport({
    host: input.smtpHost,
    port: input.smtpPort,
    secure: input.smtpPort === 465,
    auth: { user: input.smtpUser, pass: input.smtpPass },
    connectionTimeout: 15000,
  })
  try {
    await transporter.verify()
  } catch (e) {
    throw new HttpError(
      400,
      `Incoming mail works, but the sending (SMTP) details failed (${input.smtpHost}): check the server, port, and password. (${e instanceof Error ? e.message.slice(0, 120) : 'connection failed'})`,
    )
  }
}
