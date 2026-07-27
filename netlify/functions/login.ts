import type { Config } from '@netlify/functions'
import { HttpError, handle, json, readJson } from '../lib/http'
import { passcodeMatches, sessionCookie } from '../lib/session'

export default handle(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const body = await readJson<{ passcode?: unknown }>(req)
  if (typeof body.passcode !== 'string' || !passcodeMatches(body.passcode)) {
    throw new HttpError(401, 'Wrong passcode')
  }
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie() })
})

export const config: Config = { path: '/api/login' }
