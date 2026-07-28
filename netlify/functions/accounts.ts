import type { Config } from '@netlify/functions'
import type { ImapAccountInput } from '../../shared/types'
import * as accounts from '../lib/accounts'
import { handle, HttpError, json, readJson } from '../lib/http'
import { verifyImapAccount } from '../lib/imap'
import { requireSession } from '../lib/session'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function port(v: unknown, label: string): number {
  const n = Number(v)
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new HttpError(400, `${label} port must be a number between 1 and 65535`)
  }
  return n
}

function required(v: unknown, label: string): string {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) throw new HttpError(400, `${label} is required`)
  return s
}

export default handle(async (req) => {
  requireSession(req)

  if (req.method === 'GET') {
    return json((await accounts.listAccounts()).map(accounts.toPublic))
  }

  if (req.method === 'POST') {
    const raw = await readJson<ImapAccountInput>(req)
    const email = required(raw.email, 'Email address')
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'The email address does not look valid')
    const sendAs = typeof raw.sendAs === 'string' ? raw.sendAs.trim() : ''
    if (sendAs && !EMAIL_RE.test(sendAs)) {
      throw new HttpError(400, 'The send-as address does not look valid')
    }
    const input: ImapAccountInput = {
      label: (typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : email).slice(0, 60),
      email,
      sendAs,
      imapHost: required(raw.imapHost, 'Incoming (IMAP) server'),
      imapPort: port(raw.imapPort, 'Incoming (IMAP)'),
      imapUser: required(raw.imapUser, 'Incoming username'),
      imapPass: required(raw.imapPass, 'Incoming password'),
      smtpHost: required(raw.smtpHost, 'Outgoing (SMTP) server'),
      smtpPort: port(raw.smtpPort, 'Outgoing (SMTP)'),
      smtpUser: required(raw.smtpUser, 'Outgoing username'),
      smtpPass: required(raw.smtpPass, 'Outgoing password'),
    }
    // Prove the credentials work BEFORE storing anything.
    await verifyImapAccount(input)
    const acc = await accounts.createImapAccount(input)
    return json(accounts.toPublic(acc), 201)
  }

  return json({ error: 'Method not allowed' }, 405)
})

export const config: Config = { path: '/api/accounts' }
