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

/** Finds the server's Sent mailbox path (special-use flag, then common names). */
async function sentMailboxPath(client: ImapFlow): Promise<string | null> {
  const boxes = await client.list()
  const sent =
    boxes.find((b) => b.specialUse === '\\Sent') ??
    boxes.find((b) => /^(sent|sent items|sent messages|INBOX\.Sent)$/i.test(b.path))
  return sent?.path ?? null
}

/**
 * Recent envelopes from INBOX or the Sent mailbox, newest last; `known`
 * provider ids are skipped. Sent provider ids are prefixed 's:' because IMAP
 * UIDs are only unique per mailbox.
 */
export async function fetchRecentMetas(
  acc: Account,
  opts: { sinceDays: number; max: number; known: Set<string>; folder?: 'inbox' | 'sent' },
): Promise<ImapMeta[]> {
  const client = clientFor(acc)
  const metas: ImapMeta[] = []
  const isSent = opts.folder === 'sent'
  await client.connect()
  try {
    const path = isSent ? await sentMailboxPath(client) : 'INBOX'
    if (!path) return []
    const lock = await client.getMailboxLock(path)
    try {
      const since = new Date(Date.now() - opts.sinceDays * 86400_000)
      const uids = (await client.search({ since }, { uid: true })) || []
      const key = (u: number) => (isSent ? `s:${u}` : String(u))
      const fresh = uids.filter((u) => !opts.known.has(key(u))).slice(-opts.max)
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
            providerId: key(msg.uid),
            threadId: key(msg.uid), // IMAP has no cheap thread id; message stands alone
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

export interface AttachmentMeta {
  name: string
  size: number
  mimeType: string
  ref: string
}

export interface RichBody {
  text: string
  html: string | null
  attachments: AttachmentMeta[]
}

const INLINE_IMG_MAX = 300 * 1024
const INLINE_IMG_COUNT = 6

/** Removes cid-markers and angle-bracket URL wrappers from plain-text mail. */
export function cleanPlainText(s: string): string {
  return s
    .replace(/\[cid:[^\]]+\]/gi, '')
    .replace(/<(?:mailto|https?|tel):[^>]*>/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsedToRich(parsed: any): RichBody {
  let html = typeof parsed.html === 'string' && parsed.html ? parsed.html : null
  const text =
    cleanPlainText((parsed.text || '').trim()) || (html ? stripHtml(html) : '')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = Array.isArray(parsed.attachments) ? parsed.attachments : []
  const attachments: AttachmentMeta[] = []
  let embedded = 0
  all.forEach((a, i) => {
    const mime = String(a.contentType ?? 'application/octet-stream')
    const size = Number(a.size ?? a.content?.length ?? 0)
    // Signature/logo images referenced by cid: embed them into the HTML so
    // the email renders exactly as designed.
    if (a.cid && /^image\//.test(mime) && html && size <= INLINE_IMG_MAX && embedded < INLINE_IMG_COUNT && a.content) {
      const re = new RegExp(`cid:${String(a.cid).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi')
      html = html.replace(re, `data:${mime};base64,${a.content.toString('base64')}`)
      embedded++
      return
    }
    attachments.push({
      name: String(a.filename ?? `file-${i + 1}`),
      size,
      mimeType: mime,
      ref: String(i),
    })
  })

  return { text: text.slice(0, 20000), html, attachments: attachments.slice(0, 20) }
}

/** Fetches one attachment's bytes by its index ref. */
export async function fetchAttachment(
  acc: Account,
  providerId: string,
  ref: string,
): Promise<{ name: string; mimeType: string; content: Buffer }> {
  const isSent = providerId.startsWith('s:')
  const uid = isSent ? providerId.slice(2) : providerId
  const client = clientFor(acc)
  await client.connect()
  try {
    const path = isSent ? await sentMailboxPath(client) : 'INBOX'
    if (!path) throw new HttpError(404, 'Folder not found on the mail server')
    const lock = await client.getMailboxLock(path)
    try {
      const msg = await client.fetchOne(uid, { source: true }, { uid: true })
      if (!msg || !msg.source) throw new HttpError(404, 'Email not found on the mail server')
      const parsed = await simpleParser(msg.source)
      const a = (Array.isArray(parsed.attachments) ? parsed.attachments : [])[Number(ref)]
      if (!a || !a.content) throw new HttpError(404, 'Attachment not found')
      return {
        name: String(a.filename ?? 'attachment'),
        mimeType: String(a.contentType ?? 'application/octet-stream'),
        content: a.content,
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }
}

/** Downloads and parses one message body (never persisted). 's:'-prefixed
 *  provider ids live in the Sent mailbox. */
export async function fetchBodyRich(acc: Account, providerId: string): Promise<RichBody> {
  const isSent = providerId.startsWith('s:')
  const uid = isSent ? providerId.slice(2) : providerId
  const client = clientFor(acc)
  await client.connect()
  try {
    const path = isSent ? await sentMailboxPath(client) : 'INBOX'
    if (!path) throw new HttpError(404, 'Sent folder not found on the mail server')
    const lock = await client.getMailboxLock(path)
    try {
      const msg = await client.fetchOne(uid, { source: true }, { uid: true })
      if (!msg || !msg.source) throw new HttpError(404, 'Email not found on the mail server')
      return parsedToRich(await simpleParser(msg.source))
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }
}

export async function fetchBody(acc: Account, providerId: string): Promise<string> {
  return (await fetchBodyRich(acc, providerId)).text
}

/**
 * Batched body fetch over ONE connection — the difference between summarizing
 * eight emails in seconds versus opening eight TLS sessions.
 */
export async function fetchBodies(
  acc: Account,
  providerIds: string[],
): Promise<Map<string, RichBody>> {
  const out = new Map<string, RichBody>()
  if (providerIds.length === 0) return out
  const groups = {
    inbox: providerIds.filter((p) => !p.startsWith('s:')),
    sent: providerIds.filter((p) => p.startsWith('s:')),
  }
  const client = clientFor(acc)
  await client.connect()
  try {
    for (const [g, ids] of Object.entries(groups) as ['inbox' | 'sent', string[]][]) {
      if (ids.length === 0) continue
      const path = g === 'sent' ? await sentMailboxPath(client) : 'INBOX'
      if (!path) continue
      const lock = await client.getMailboxLock(path)
      try {
        for (const pid of ids) {
          try {
            const uid = g === 'sent' ? pid.slice(2) : pid
            const msg = await client.fetchOne(uid, { source: true }, { uid: true })
            if (msg && msg.source) out.set(pid, parsedToRich(await simpleParser(msg.source)))
          } catch (e) {
            console.error('imap body fetch failed', pid, e)
          }
        }
      } finally {
        lock.release()
      }
    }
  } finally {
    await client.logout().catch(() => {})
  }
  return out
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

/**
 * History dig: envelopes with UIDs just below the oldest one we have stored —
 * called repeatedly across syncs until the mailbox's very first email.
 */
export async function fetchOlderMetas(
  acc: Account,
  opts: { folder: 'inbox' | 'sent'; beforeProviderId: string; max: number },
): Promise<ImapMeta[]> {
  const isSent = opts.folder === 'sent'
  const ceil = Number.parseInt(
    isSent ? opts.beforeProviderId.replace(/^s:/, '') : opts.beforeProviderId,
    10,
  )
  if (!Number.isFinite(ceil) || ceil <= 1) return []
  const from = Math.max(1, ceil - Math.max(opts.max, 50) * 3) // over-fetch range; UIDs are sparse
  const client = clientFor(acc)
  const metas: ImapMeta[] = []
  await client.connect()
  try {
    const path = isSent ? await sentMailboxPath(client) : 'INBOX'
    if (!path) return []
    const lock = await client.getMailboxLock(path)
    try {
      const key = (u: number) => (isSent ? `s:${u}` : String(u))
      for await (const msg of client.fetch(
        `${from}:${ceil - 1}`,
        { envelope: true, internalDate: true, uid: true },
        { uid: true },
      )) {
        const env = msg.envelope
        if (!env) continue
        const fromAddr = addr(env.from?.[0])
        metas.push({
          providerId: key(msg.uid),
          threadId: key(msg.uid),
          fromName: fromAddr.name || fromAddr.email,
          fromEmail: fromAddr.email,
          toEmails: [...(env.to ?? []), ...(env.cc ?? [])]
            .map((a) => addr(a).email)
            .filter(Boolean)
            .slice(0, 10),
          subject: env.subject || '(no subject)',
          snippet: '',
          receivedAt: new Date(msg.internalDate ?? Date.now()).toISOString(),
          messageIdHeader: env.messageId ?? null,
        })
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }
  return metas.slice(-opts.max)
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
