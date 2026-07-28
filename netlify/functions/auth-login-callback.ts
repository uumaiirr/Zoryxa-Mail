import type { Config } from '@netlify/functions'
import { exchangeLoginCode } from '../lib/google-identity'
import { handle } from '../lib/http'
import { sessionCookieFor, verifyOauthState } from '../lib/session'
import { loginAllowed, upsertUserByEmail } from '../lib/users'

function redirect(url: string, cookie?: string): Response {
  const headers: Record<string, string> = { Location: url }
  if (cookie) headers['Set-Cookie'] = cookie
  return new Response(null, { status: 302, headers })
}

// Google returns here after "Continue with Google".
export default handle(async (req) => {
  const params = new URL(req.url).searchParams
  const code = params.get('code')
  if (params.get('error') || !code) return redirect('/login?e=cancelled')
  if (!verifyOauthState(params.get('state'), 'login')) {
    console.error('login callback rejected: bad state')
    return redirect('/login?e=retry')
  }
  try {
    const who = await exchangeLoginCode(code)
    if (!loginAllowed(who.email)) {
      console.error('login denied (not on ALLOWED_LOGIN_EMAILS):', who.email)
      return redirect('/login?e=denied')
    }
    const user = await upsertUserByEmail(who.email, who.name, who.picture)
    return redirect('/', sessionCookieFor(user.id))
  } catch (e) {
    console.error('login failed', e)
    return redirect('/login?e=failed')
  }
})

export const config: Config = { path: '/api/auth/login/callback' }
