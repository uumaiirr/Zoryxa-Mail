import type { Config } from '@netlify/functions'
import { handle, HttpError, json, readJson } from '../lib/http'
import { requireSession } from '../lib/session'
import { buildStyleProfile } from '../lib/style-core'

export default handle(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  requireSession(req)
  const { accountId } = await readJson<{ accountId: string }>(req)
  if (typeof accountId !== 'string' || accountId.trim() === '') {
    throw new HttpError(400, 'accountId is required')
  }
  const r = await buildStyleProfile(accountId)
  return json({ ok: true, sampleCount: r.sampleCount })
})

export const config: Config = { path: '/api/style/refresh' }
