import type { Config } from '@netlify/functions'
import { handle, json } from '../lib/http'
import { clearSessionCookie } from '../lib/session'

export default handle(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() })
})

export const config: Config = { path: '/api/logout' }
