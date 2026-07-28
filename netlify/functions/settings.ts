import type { Config } from '@netlify/functions'
import type { AppSettings, Category } from '../../shared/types'
import { HttpError, handle, json, readJson } from '../lib/http'
import { requireSession } from '../lib/session'
import * as store from '../lib/store'

const HEX_RE = /^#[0-9a-fA-F]{6}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function sanitizeCategories(raw: unknown): Category[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new HttpError(400, 'At least one category is required')
  }
  const used = new Set<string>()
  return raw.map((item): Category => {
    const c = (item ?? {}) as Record<string, unknown>
    const label = String(c.label || 'Category').slice(0, 40)
    let key = String(c.key || slug(String(c.label ?? '')) || 'category').slice(0, 40)
    if (used.has(key)) {
      let n = 2
      while (used.has(`${key}-${n}`)) n++
      key = `${key}-${n}`
    }
    used.add(key)
    const rawColor = String(c.color)
    return {
      key,
      label,
      color: HEX_RE.test(rawColor) ? rawColor : '#64748B',
      description: String(c.description ?? '').slice(0, 300),
    }
  })
}

function sanitize(raw: Partial<AppSettings>): AppSettings {
  const categories = sanitizeCategories(raw.categories)

  const digestHour = Number(raw.digestHour)
  if (!Number.isInteger(digestHour) || digestHour < 0 || digestHour > 23) {
    throw new HttpError(400, 'Digest hour must be between 0 and 23')
  }

  const timezone = String(raw.timezone ?? '')
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone })
  } catch {
    throw new HttpError(400, 'Unknown timezone — use a name like Asia/Dubai')
  }

  const digestTo = String(raw.digestTo ?? '').trim()
  if (digestTo !== '' && !EMAIL_RE.test(digestTo)) {
    throw new HttpError(400, 'The digest email address does not look valid — check it and try again')
  }

  return {
    categories,
    digestHour,
    timezone,
    digestTo,
    llmProvider: raw.llmProvider === 'groq' ? 'groq' : 'gemini',
    historyDays: [1, 7, 30, 90, 3650].includes(Number(raw.historyDays))
      ? Number(raw.historyDays)
      : 90,
  }
}

export default handle(async (req) => {
  const userId = requireSession(req)
  if (req.method === 'GET') return json(await store.getSettings(userId))
  if (req.method === 'PUT') {
    const raw = await readJson<Partial<AppSettings>>(req)
    const clean = sanitize(raw)
    await store.saveSettings(userId, clean)
    return json(clean)
  }
  return json({ error: 'Method not allowed' }, 405)
})

export const config: Config = { path: '/api/settings' }
