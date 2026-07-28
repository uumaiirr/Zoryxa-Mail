import { accountRefreshToken, upsertGmailAccount, type Account } from './accounts'
import { env } from './env'
import { HttpError } from './http'

const OAUTH_SCOPES =
  'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send'
const API = 'https://gmail.googleapis.com/gmail/v1/users/me'

function redirectUri(): string {
  return `${env('SITE_URL')}/api/auth/google/callback`
}

// ── OAuth ─────────────────────────────────────────────────────────────────────

export function oauthStartUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID'),
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: OAUTH_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/** Exchanges the consent code and stores/updates the Gmail account for one user. */
export async function exchangeCodeAndStore(userId: string, code: string): Promise<string> {
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
    throw new HttpError(502, `Google token exchange failed: ${(await res.text()).slice(0, 300)}`)
  }
  const data = (await res.json()) as { access_token: string; refresh_token?: string }
  if (!data.refresh_token) {
    throw new HttpError(
      502,
      'Google did not return a refresh token. Remove the app at myaccount.google.com/permissions, then connect again.',
    )
  }
  const profileRes = await fetch(`${API}/profile`, {
    headers: { Authorization: `Bearer ${data.access_token}` },
  })
  if (!profileRes.ok) {
    throw new HttpError(502, `Could not read the Gmail profile (${profileRes.status})`)
  }
  const profile = (await profileRes.json()) as { emailAddress: string }
  await upsertGmailAccount(userId, profile.emailAddress, data.refresh_token)
  return profile.emailAddress
}

// Access tokens cached per account for the life of the function instance.
const tokenCache = new Map<string, { token: string; exp: number }>()

async function accessToken(acc: Account): Promise<string> {
  const cached = tokenCache.get(acc.id)
  if (cached && cached.exp > Date.now()) return cached.token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      refresh_token: accountRefreshToken(acc),
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    throw new HttpError(
      502,
      `Gmail token refresh failed for ${acc.email} (${res.status}) — reconnect it in Settings`,
    )
  }
  const data = (await res.json()) as { access_token: string; expires_in: number }
  const entry = {
    token: data.access_token,
    exp: Date.now() + Math.max(60, (data.expires_in ?? 3600) - 300) * 1000,
  }
  tokenCache.set(acc.id, entry)
  return entry.token
}

async function gapi(
  acc: Account,
  path: string,
  init: RequestInit = {},
  opts: { retry5xx?: boolean } = {},
): Promise<unknown> {
  let lastStatus = 0
  for (let attempt = 0; attempt < 3; attempt++) {
    const token = await accessToken(acc)
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    })
    if (res.ok) return res.json()
    lastStatus = res.status
    if (res.status === 401) {
      tokenCache.delete(acc.id) // stale access token — refresh and retry
      continue
    }
    // 429 means the request was rejected, so retrying is always safe. A 5xx on
    // a non-idempotent call (message send) may have gone through — callers
    // disable 5xx retries there to avoid duplicates.
    if (res.status === 429 || (res.status >= 500 && opts.retry5xx !== false)) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1) + Math.random() * 500))
      continue
    }
    throw new HttpError(502, `Gmail API error ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }
  throw new HttpError(502, `Gmail API unavailable after retries (last status ${lastStatus})`)
}

// ── reading mail ──────────────────────────────────────────────────────────────

export async function listInboxIds(
  acc: Account,
  query: string,
  max = 50,
): Promise<{ id: string; threadId: string }[]> {
  const params = new URLSearchParams({ q: query, maxResults: String(max) })
  const data = (await gapi(acc, `/messages?${params.toString()}`)) as {
    messages?: { id: string; threadId: string }[]
  }
  return data.messages ?? []
}

export interface MessageMeta {
  gmailId: string
  threadId: string
  fromName: string
  fromEmail: string
  toEmails: string[]
  subject: string
  snippet: string
  receivedAt: string
  messageIdHeader: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function header(data: any, name: string): string {
  const h = (data.payload?.headers ?? []).find(
    (x: { name: string; value: string }) => x.name.toLowerCase() === name.toLowerCase(),
  )
  return h?.value ?? ''
}

export function parseAddress(raw: string): { name: string; email: string } {
  const m = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/)
  if (m) return { name: m[1].trim() || m[2].trim(), email: m[2].trim() }
  const email = raw.trim()
  return { name: email, email }
}

function decodeEntities(s: string): string {
  // &amp; must decode LAST, or doubly-escaped text ("&amp;lt;") over-decodes.
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

/** Splits an RFC 5322 address list on commas, ignoring commas inside quotes. */
function splitAddressList(raw: string): string[] {
  const parts: string[] = []
  let current = ''
  let inQuotes = false
  for (const ch of raw) {
    if (ch === '"') {
      inQuotes = !inQuotes
      current += ch
    } else if (ch === ',' && !inQuotes) {
      parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  parts.push(current)
  return parts.map((p) => p.trim()).filter(Boolean)
}

export async function getMeta(acc: Account, id: string): Promise<MessageMeta> {
  const data = (await gapi(
    acc,
    `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Message-ID`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  )) as any
  const from = parseAddress(header(data, 'From'))
  const toRaw = [header(data, 'To'), header(data, 'Cc')].filter(Boolean).join(', ')
  const toEmails = splitAddressList(toRaw)
    .map((p) => parseAddress(p).email)
    .filter((e) => e.includes('@'))
    .slice(0, 10)
  return {
    gmailId: data.id,
    threadId: data.threadId,
    fromName: from.name,
    fromEmail: from.email,
    toEmails,
    subject: header(data, 'Subject') || '(no subject)',
    snippet: decodeEntities(data.snippet ?? ''),
    receivedAt: new Date(Number(data.internalDate)).toISOString(),
    messageIdHeader: header(data, 'Message-ID') || null,
  }
}

function decodeB64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Fetches the message body live from Gmail. Bodies are never persisted. */
export async function getBody(acc: Account, id: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await gapi(acc, `/messages/${id}?format=full`)) as any
  let text = ''
  let html = ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (part: any): void => {
    if (!part) return
    const mime: string = part.mimeType ?? ''
    const body = part.body?.data
    if (body && mime === 'text/plain') text += decodeB64Url(body)
    else if (body && mime === 'text/html') html += decodeB64Url(body)
    for (const p of part.parts ?? []) walk(p)
  }
  walk(data.payload)
  return (text.trim() || stripHtml(html) || decodeEntities(data.snippet ?? '')).slice(0, 20000)
}

export async function listSentSamples(
  acc: Account,
  max = 12,
): Promise<{ to: string; subject: string; body: string }[]> {
  const ids = await listInboxIds(acc, 'in:sent', max)
  const samples: { to: string; subject: string; body: string }[] = []
  // Bounded parallelism keeps this well inside one function invocation.
  for (let i = 0; i < ids.length; i += 4) {
    const chunk = ids.slice(i, i + 4)
    const results = await Promise.all(
      chunk.map(async (m) => {
        try {
          const meta = await getMeta(acc, m.id)
          const body = (await getBody(acc, m.id)).slice(0, 1500)
          if (body.length < 40) return null // skip empty / one-liner forwards
          return { to: meta.toEmails.join(', '), subject: meta.subject, body }
        } catch (e) {
          console.error('sent sample fetch failed', m.id, e)
          return null
        }
      }),
    )
    for (const r of results) if (r) samples.push(r)
  }
  return samples
}

// ── push notifications (real-time arrival) ────────────────────────────────────

/**
 * Registers a Gmail watch so new inbox mail publishes to the given Cloud
 * Pub/Sub topic (which pushes to /api/gmail/push within seconds). Watches
 * expire after ~7 days; the hourly cron renews them via sync-core.
 */
export async function watchInbox(acc: Account, topicName: string): Promise<{ expiresAt: string }> {
  const data = (await gapi(acc, '/watch', {
    method: 'POST',
    body: JSON.stringify({
      topicName,
      labelIds: ['INBOX'],
      labelFilterBehavior: 'INCLUDE',
    }),
  })) as { expiration: string }
  return { expiresAt: new Date(Number(data.expiration)).toISOString() }
}

// ── sending mail ──────────────────────────────────────────────────────────────

function encodeHeader(s: string): string {
  if (/^[\x20-\x7e]*$/.test(s)) return s
  return `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`
}

function chunk76(b64: string): string {
  return b64.match(/.{1,76}/g)?.join('\r\n') ?? b64
}

export interface SendOpts {
  to: string
  cc?: string
  subject: string
  body: string
  /** When set, the message is sent as text/html using this markup instead of `body`. */
  html?: string
  inReplyTo?: string | null
  references?: string | null
  threadId?: string | null
}

export async function sendMail(acc: Account, opts: SendOpts): Promise<{ id: string }> {
  const from = acc.sendAs || acc.email
  if (!from) throw new HttpError(500, 'This account has no sending address configured')
  const contentType = opts.html ? 'text/html' : 'text/plain'
  const payload = opts.html ?? opts.body
  const lines = [
    `From: ${from}`,
    `To: ${opts.to}`,
    ...(opts.cc ? [`Cc: ${opts.cc}`] : []),
    `Subject: ${encodeHeader(opts.subject)}`,
    ...(opts.inReplyTo ? [`In-Reply-To: ${opts.inReplyTo}`] : []),
    ...(opts.references ? [`References: ${opts.references}`] : []),
    'MIME-Version: 1.0',
    `Content-Type: ${contentType}; charset=UTF-8`,
    'Content-Transfer-Encoding: base64',
    '',
    chunk76(Buffer.from(payload, 'utf8').toString('base64')),
  ]
  const raw = Buffer.from(lines.join('\r\n'), 'utf8').toString('base64url')
  const data = (await gapi(
    acc,
    '/messages/send',
    {
      method: 'POST',
      body: JSON.stringify({ raw, ...(opts.threadId ? { threadId: opts.threadId } : {}) }),
    },
    // A 5xx may mean Gmail accepted the message — never blind-retry a send.
    { retry5xx: false },
  )) as { id: string }
  return { id: data.id }
}
