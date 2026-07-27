import type { Config } from '@netlify/functions'
import { handle, json } from '../lib/http'
import { requireSession } from '../lib/session'
import { buildStyleProfile } from '../lib/style-core'

export default handle(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  requireSession(req)
  const r = await buildStyleProfile()
  return json({ ok: true, sampleCount: r.sampleCount })
})

export const config: Config = { path: '/api/style/refresh' }
