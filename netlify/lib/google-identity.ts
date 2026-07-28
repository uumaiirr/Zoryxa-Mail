// "Continue with Google" — sign-in identity only (openid/email/profile).
// Completely separate from connecting a Gmail MAILBOX (gmail.ts), which asks
// for mail permissions. Signing in reads nothing but who you are.
import { env } from './env'
import { HttpError } from './http'

function redirectUri(): string {
  return `${env('SITE_URL')}/api/auth/login/callback`
}

export function loginStartUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID'),
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export async function exchangeLoginCode(
  code: string,
): Promise<{ email: string; name: string; picture: string }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    throw new HttpError(502, `Google sign-in failed: ${(await res.text()).slice(0, 200)}`)
  }
  const data = (await res.json()) as { id_token?: string }
  if (!data.id_token) throw new HttpError(502, 'Google sign-in failed: no identity token')

  // Let Google verify its own token's signature.
  const info = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(data.id_token)}`,
  )
  if (!info.ok) throw new HttpError(502, 'Google sign-in failed: identity check')
  const claims = (await info.json()) as {
    aud?: string
    email?: string
    email_verified?: string
    name?: string
    picture?: string
  }
  if (claims.aud !== env('GOOGLE_CLIENT_ID') || claims.email_verified !== 'true' || !claims.email) {
    throw new HttpError(401, 'Google sign-in could not be verified')
  }
  return { email: claims.email, name: claims.name ?? '', picture: claims.picture ?? '' }
}
