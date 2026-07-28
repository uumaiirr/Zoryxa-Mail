import type { Config } from '@netlify/functions'
import * as accounts from '../lib/accounts'
import { handle, HttpError, json, readJson } from '../lib/http'
import * as mailbox from '../lib/mailbox'
import { requireSession } from '../lib/session'
import * as store from '../lib/store'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Every comma-separated address must look like a real email address. */
function assertAddresses(raw: string, label: string): void {
  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) {
    throw new HttpError(400, `The "${label}" field needs at least one email address`)
  }
  for (const p of parts) {
    if (!EMAIL_RE.test(p)) {
      throw new HttpError(400, `"${p}" doesn't look like a valid email address`)
    }
  }
}

// SAFETY CRITICAL: this is the only path that sends user-composed mail, and it
// only ever runs from an explicit user confirmation in the UI.
export default handle(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  requireSession(req)

  const body = await readJson<{
    to: string
    cc?: string
    subject: string
    body: string
    replyToId?: string
    fromAccountId?: string
  }>(req)

  if (typeof body.to !== 'string' || body.to.trim() === '') {
    throw new HttpError(400, 'Please add a recipient before sending')
  }
  assertAddresses(body.to, 'to')
  if (body.cc !== undefined && body.cc !== null && String(body.cc).trim() !== '') {
    assertAddresses(String(body.cc), 'cc')
  }
  if (typeof body.subject !== 'string' || body.subject.trim() === '') {
    throw new HttpError(400, 'Please add a subject before sending')
  }
  if (body.subject.length > 300) {
    throw new HttpError(400, 'The subject is too long — keep it under 300 characters')
  }
  if (typeof body.body !== 'string' || body.body.trim() === '') {
    throw new HttpError(400, 'The message is empty — write something before sending')
  }
  if (body.body.length > 50000) {
    throw new HttpError(400, 'The message is too long to send — please shorten it')
  }

  let acc: accounts.Account | null = null
  let threading: {
    inReplyTo?: string | null
    references?: string | null
    threadId?: string | null
  } = {}

  if (typeof body.replyToId === 'string' && body.replyToId.trim() !== '') {
    const original = await store.getEmail(body.replyToId)
    if (!original) throw new HttpError(404, 'Original email not found')
    acc = await accounts.getAccount(original.accountId)
    if (!acc) throw new HttpError(404, 'Mail account not found')
    try {
      threading = await mailbox.getThreading(acc, store.providerIdOf(original))
    } catch (e) {
      // The original may be gone from the server — send unthreaded.
      console.error('threading metadata unavailable, sending unthreaded', body.replyToId, e)
    }
  } else {
    if (typeof body.fromAccountId !== 'string' || body.fromAccountId.trim() === '') {
      throw new HttpError(400, 'Choose which account to send from')
    }
    acc = await accounts.getAccount(body.fromAccountId)
    if (!acc) throw new HttpError(404, 'Mail account not found')
  }

  const r = await mailbox.sendFrom(acc, {
    to: body.to,
    cc: body.cc || undefined,
    subject: body.subject,
    body: body.body,
    ...threading,
  })
  return json({ ok: true, id: r.id })
})

export const config: Config = { path: '/api/send' }
