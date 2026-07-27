import type { Config } from '@netlify/functions'
import type { EmailDetail } from '../../shared/types'
import * as gmail from '../lib/gmail'
import { handle, HttpError, json } from '../lib/http'
import { requireSession } from '../lib/session'
import * as store from '../lib/store'

export default handle(async (req, context) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  requireSession(req)

  const id = decodeURIComponent(context.params.id)
  const summary = await store.getEmail(id)
  if (!summary) throw new HttpError(404, 'Email not found')

  // Bodies are never persisted — always fetched live from Gmail (privacy requirement).
  let body: string
  try {
    body = await gmail.getBody(id)
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

  const detail: EmailDetail = { ...summary, body, isRead: true, draft }
  return json(detail)
})

export const config: Config = { path: '/api/emails/:id' }
