import type { Config } from '@netlify/functions'
import type { EmailDetail } from '../../shared/types'
import * as accounts from '../lib/accounts'
import { handle, HttpError, json } from '../lib/http'
import * as mailbox from '../lib/mailbox'
import { requireSession } from '../lib/session'
import * as store from '../lib/store'

export default handle(async (req, context) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  const userId = requireSession(req)

  const id = decodeURIComponent(context.params.id)
  const summary = await store.getUserEmail(id, userId)
  const acc = await accounts.getAccount(summary.accountId)
  if (!acc) throw new HttpError(404, 'Mail account not found')

  // Bodies are never persisted — always fetched live from the mailbox.
  let body: string
  let bodyHtml: string | null = null
  let attachments: EmailDetail['attachments'] = []
  try {
    const rich = await mailbox.getBodyRich(acc, store.providerIdOf(summary))
    body = rich.text || summary.snippet
    bodyHtml = rich.html ? rich.html.slice(0, 900_000) : null
    attachments = rich.attachments
  } catch {
    body = summary.snippet
  }

  try {
    await store.markRead(id)
  } catch (e) {
    console.error('markRead failed', id, e)
  }

  let draft: { subject: string; body: string } | null = null
  try {
    draft = await store.getDraft(id)
  } catch (e) {
    console.error('getDraft failed', id, e)
  }

  // The conversation trace — earlier messages in the same thread.
  let thread: EmailDetail['thread'] = []
  try {
    thread = (await store.threadEmails(userId, summary.threadId, summary.accountId))
      .filter((t) => t.id !== summary.id)
      .map((t) => ({
        id: t.id,
        fromName: t.fromName,
        subject: t.subject,
        snippet: t.snippet,
        receivedAt: t.receivedAt,
        folder: t.folder,
      }))
  } catch (e) {
    console.error('thread lookup failed', id, e)
  }

  const detail: EmailDetail = {
    ...summary,
    body,
    bodyHtml,
    attachments,
    thread,
    isRead: true,
    draft,
  }
  return json(detail)
})

export const config: Config = { path: '/api/emails/:id' }
