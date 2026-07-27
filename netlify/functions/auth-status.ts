import type { Config } from '@netlify/functions'
import type { AuthStatus } from '../../shared/types'
import * as gmail from '../lib/gmail'
import { handle, json } from '../lib/http'
import { hasValidSession } from '../lib/session'

export default handle(async (req) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  if (!hasValidSession(req)) {
    // 200 (not 401) so the app can route to the login screen without looping.
    const out: AuthStatus = { authed: false, gmailConnected: false, grantedEmail: null }
    return json(out)
  }
  const g = await gmail.isConnected()
  const out: AuthStatus = { authed: true, gmailConnected: g.connected, grantedEmail: g.email }
  return json(out)
})

export const config: Config = { path: '/api/auth/status' }
