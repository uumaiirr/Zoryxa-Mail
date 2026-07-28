import type { Config } from '@netlify/functions'
import { handle, json } from '../lib/http'
import { requireSession } from '../lib/session'
import * as store from '../lib/store'

export default handle(async (req) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  const userId = requireSession(req)

  const params = new URL(req.url).searchParams
  const category = params.get('category')
  const account = params.get('account')
  const before = params.get('before')
  const folder = params.get('folder') === 'sent' ? ('sent' as const) : ('inbox' as const)

  const rawLimit = Number.parseInt(params.get('limit') ?? '', 10)
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50

  const emails = await store.listEmails({
    userId,
    folder,
    drafts: params.get('drafts') === '1',
    category: category || undefined,
    account: account || undefined,
    limit,
    before: before || undefined,
  })
  return json(emails)
})

export const config: Config = { path: '/api/emails' }
