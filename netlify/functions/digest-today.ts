import type { Config } from '@netlify/functions'
import { handle, json } from '../lib/http'
import { requireSession } from '../lib/session'
import { getDigest, getSettings } from '../lib/store'
import { todayIn } from '../lib/sync-core'

/** Formats a Date as YYYY-MM-DD in the given IANA timezone (en-CA gives ISO order). */
function dateIn(timezone: string, d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(d)
}

export default handle(async (req) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  const userId = requireSession(req)

  const settings = await getSettings(userId)
  const today = todayIn(settings.timezone)

  let digest = await getDigest(userId, today)
  if (!digest) {
    const yesterday = dateIn(settings.timezone, new Date(Date.now() - 86400000))
    digest = await getDigest(userId, yesterday)
  }

  return json({ digest: digest ?? null })
})

export const config: Config = { path: '/api/digest/today' }
