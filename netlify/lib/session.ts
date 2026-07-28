import { hmacHex, safeEqual } from './crypto'
import { secretEnv } from './env'
import { HttpError } from './http'

// Personal sessions: the cookie carries the signed user id, minted only by the
// Google sign-in callback. No passwords exist anywhere in this product.

const COOKIE_NAME = 'zx_session'
const THIRTY_DAYS_S = 30 * 24 * 60 * 60

function sign(userId: string, exp: number): string {
  return hmacHex(secretEnv('SESSION_SECRET'), `${userId}.${exp}`)
}

export function sessionCookieFor(userId: string): string {
  const exp = Date.now() + THIRTY_DAYS_S * 1000
  return `${COOKIE_NAME}=${userId}.${exp}.${sign(userId, exp)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${THIRTY_DAYS_S}`
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}

/** The signed-in user's id, or null. */
export function sessionUserId(req: Request): string | null {
  const cookies = req.headers.get('cookie') ?? ''
  const pair = cookies.split(/;\s*/).find((c) => c.startsWith(`${COOKIE_NAME}=`))
  if (!pair) return null
  const token = pair.slice(COOKIE_NAME.length + 1)
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [userId, expRaw, sig] = parts
  const exp = Number(expRaw)
  if (!userId || !Number.isFinite(exp) || exp < Date.now()) return null
  if (!safeEqual(sig, sign(userId, exp))) return null
  return userId
}

export function hasValidSession(req: Request): boolean {
  return sessionUserId(req) !== null
}

/** Returns the signed-in user's id or throws 401. */
export function requireSession(req: Request): string {
  const userId = sessionUserId(req)
  if (!userId) throw new HttpError(401, 'Not signed in')
  return userId
}

/**
 * For endpoints the scheduler hits: the cron secret (returns null) OR a user
 * session (returns the user id).
 */
export function requireCronOrSession(req: Request): string | null {
  const secret = req.headers.get('x-cron-secret')
  if (secret && safeEqual(secret, secretEnv('CRON_SECRET'))) return null
  return requireSession(req)
}

// ── OAuth CSRF protection ─────────────────────────────────────────────────────
// Both Google flows (sign-in, and connecting a mailbox) carry a signed,
// short-lived `state`; callbacks reject anything we didn't mint.

const OAUTH_STATE_TTL_MS = 10 * 60_000

export function makeOauthState(purpose: 'login' | 'connect'): string {
  const exp = Date.now() + OAUTH_STATE_TTL_MS
  return `${purpose}.${exp}.${hmacHex(secretEnv('SESSION_SECRET'), `oauth:${purpose}:${exp}`)}`
}

export function verifyOauthState(state: string | null, purpose: 'login' | 'connect'): boolean {
  if (!state) return false
  const parts = state.split('.')
  if (parts.length !== 3) return false
  const [p, expRaw, sig] = parts
  const exp = Number(expRaw)
  if (p !== purpose || !Number.isFinite(exp) || exp < Date.now()) return false
  return safeEqual(sig, hmacHex(secretEnv('SESSION_SECRET'), `oauth:${purpose}:${exp}`))
}
