import type { Config } from '@netlify/functions'
import { loginStartUrl } from '../lib/google-identity'
import { handle } from '../lib/http'
import { makeOauthState } from '../lib/session'

// The "Continue with Google" button points here.
export default handle(async () => {
  return new Response(null, {
    status: 302,
    headers: { Location: loginStartUrl(makeOauthState('login')) },
  })
})

export const config: Config = { path: '/api/auth/login' }
