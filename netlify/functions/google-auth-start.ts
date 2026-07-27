import type { Config } from '@netlify/functions'
import * as gmail from '../lib/gmail'
import { handle } from '../lib/http'
import { hasValidSession, makeOauthState } from '../lib/session'

function redirect(url: string): Response {
  return new Response(null, { status: 302, headers: { Location: url } })
}

// Opened by full-page navigation from the Settings screen. The signed `state`
// value is verified by the callback (CSRF protection).
export default handle(async (req) => {
  if (!hasValidSession(req)) return redirect('/login')
  return redirect(gmail.oauthStartUrl(makeOauthState()))
})

export const config: Config = { path: '/api/auth/google/start' }
