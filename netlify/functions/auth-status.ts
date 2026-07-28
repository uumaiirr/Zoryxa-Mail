import type { Config } from '@netlify/functions'
import type { AuthStatus } from '../../shared/types'
import * as accounts from '../lib/accounts'
import { handle, json } from '../lib/http'
import { sessionUserId } from '../lib/session'
import { getUser } from '../lib/users'

export default handle(async (req) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  const userId = sessionUserId(req)
  if (!userId) {
    // 200 (not 401) so the app can route to the sign-in screen without looping.
    const out: AuthStatus = { authed: false, accountCount: 0, user: null }
    return json(out)
  }
  try {
    const user = await getUser(userId)
    const accountCount = (await accounts.listAccounts(userId)).length
    const out: AuthStatus = {
      authed: true,
      accountCount,
      user: { email: user.email, name: user.name, picture: user.picture },
    }
    return json(out)
  } catch {
    const out: AuthStatus = { authed: false, accountCount: 0, user: null }
    return json(out)
  }
})

export const config: Config = { path: '/api/auth/status' }
