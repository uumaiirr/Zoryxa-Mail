import type { Config } from '@netlify/functions'
import * as gmail from '../lib/gmail'
import { handle } from '../lib/http'
import { sessionUserId, verifyOauthState } from '../lib/session'

function redirect(url: string): Response {
  return new Response(null, { status: 302, headers: { Location: url } })
}

// Google redirects here after the mailbox-connect consent screen.
export default handle(async (req) => {
  const userId = sessionUserId(req)
  if (!userId) return redirect('/login')
  const params = new URL(req.url).searchParams
  const code = params.get('code')
  if (params.get('error') || !code) return redirect('/settings?gmail=error')
  // Reject any code we didn't initiate ourselves (CSRF: without this, a
  // crafted link could silently swap the connected Gmail account).
  if (!verifyOauthState(params.get('state'), 'connect')) {
    console.error('OAuth callback rejected: missing or invalid state')
    return redirect('/settings?gmail=error')
  }
  try {
    await gmail.exchangeCodeAndStore(userId, code)
    return redirect('/settings?gmail=connected')
  } catch (e) {
    console.error(e)
    return redirect('/settings?gmail=error')
  }
})

export const config: Config = { path: '/api/auth/google/callback' }
