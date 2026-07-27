import { hmacHex, safeEqual } from './crypto'
import { secretEnv } from './env'
import { HttpError } from './http'

const COOKIE_NAME = 'ceo_session'
const THIRTY_DAYS_S = 30 * 24 * 60 * 60

function sign(exp: number): string {
  return `${exp}.${hmacHex(secretEnv('SESSION_SECRET'), String(exp))}`
}

export function sessionCookie(): string {
  const exp = Date.now() + THIRTY_DAYS_S * 1000
  return `${COOKIE_NAME}=${sign(exp)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${THIRTY_DAYS_S}`
}

export function hasValidSession(req: Request): boolean {
  const cookies = req.headers.get('cookie') ?? ''
  const pair = cookies.split(/;\s*/).find((c) => c.startsWith(`${COOKIE_NAME}=`))
  if (!pair) return false
  const token = pair.slice(COOKIE_NAME.length + 1)
  const dot = token.indexOf('.')
  if (dot < 1) return false
  const exp = Number(token.slice(0, dot))
  if (!Number.isFinite(exp) || exp < Date.now()) return false
  return safeEqual(token, sign(exp))
}

export function requireSession(req: Request): void {
  if (!hasValidSession(req)) throw new HttpError(401, 'Not signed in')
}

/** For endpoints the scheduler hits: accept the cron secret OR a user session. */
export function requireCronOrSession(req: Request): void {
  const secret = req.headers.get('x-cron-secret')
  if (secret && safeEqual(secret, secretEnv('CRON_SECRET'))) return
  requireSession(req)
}

export function passcodeMatches(passcode: string): boolean {
  return passcode.length > 0 && safeEqual(passcode, secretEnv('APP_PASSCODE'))
}

// ── OAuth CSRF protection ─────────────────────────────────────────────────────
// The Google consent flow carries a signed, short-lived `state` value; the
// callback rejects any code exchange whose state we didn't mint. Without this,
// a crafted link could swap the connected Gmail account for an attacker's.

const OAUTH_STATE_TTL_MS = 10 * 60_000

export function makeOauthState(): string {
  const exp = Date.now() + OAUTH_STATE_TTL_MS
  return `${exp}.${hmacHex(secretEnv('SESSION_SECRET'), `oauth:${exp}`)}`
}

export function verifyOauthState(state: string | null): boolean {
  if (!state) return false
  const dot = state.indexOf('.')
  if (dot < 1) return false
  const exp = Number(state.slice(0, dot))
  if (!Number.isFinite(exp) || exp < Date.now()) return false
  return safeEqual(state, `${exp}.${hmacHex(secretEnv('SESSION_SECRET'), `oauth:${exp}`)}`)
}
