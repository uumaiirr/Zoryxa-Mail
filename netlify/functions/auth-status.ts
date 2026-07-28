import type { Config } from '@netlify/functions'
import type { AuthStatus } from '../../shared/types'
import * as accounts from '../lib/accounts'
import { handle, json } from '../lib/http'
import { hasValidSession } from '../lib/session'

export default handle(async (req) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  if (!hasValidSession(req)) {
    // 200 (not 401) so the app can route to the login screen without looping.
    const out: AuthStatus = { authed: false, accountCount: 0 }
    return json(out)
  }
  let accountCount = 0
  try {
    accountCount = (await accounts.listAccounts()).length
  } catch (e) {
    console.error('account count failed', e)
  }
  const out: AuthStatus = { authed: true, accountCount }
  return json(out)
})

export const config: Config = { path: '/api/auth/status' }
