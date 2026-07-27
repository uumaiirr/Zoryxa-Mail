import type { Config } from '@netlify/functions'
import { handle, json } from '../lib/http'
import { requireCronOrSession } from '../lib/session'
import { runSync } from '../lib/sync-core'

export default handle(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  requireCronOrSession(req)

  const body = (await req.json().catch(() => ({}))) as { force?: boolean }
  const result = await runSync({ force: Boolean(body.force) })
  return json(result)
})

export const config: Config = { path: '/api/sync' }
