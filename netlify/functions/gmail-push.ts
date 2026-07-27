import type { Config } from '@netlify/functions'
import { safeEqual } from '../lib/crypto'
import { secretEnv } from '../lib/env'
import { handle, json } from '../lib/http'
import { runSync } from '../lib/sync-core'

/**
 * Cloud Pub/Sub push endpoint — Gmail publishes here the moment new mail
 * lands in the bridge inbox, so emails appear in the app within seconds.
 *
 * Auth: the push subscription URL carries ?token=<CRON_SECRET>. The Pub/Sub
 * message body (base64 of {emailAddress, historyId}) contains no mail content
 * and is not needed: we simply run a normal sync, which is idempotent.
 */
export default handle(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const token = new URL(req.url).searchParams.get('token') ?? ''
  if (token === '' || !safeEqual(token, secretEnv('CRON_SECRET'))) {
    return json({ error: 'Forbidden' }, 403)
  }

  try {
    // A short debounce (instead of force) coalesces morning bursts — six mails
    // in a minute become one or two syncs, not six parallel LLM storms —
    // while still feeling instant.
    const result = await runSync({ debounceMs: 20_000 })
    return json({ ok: true, ...result })
  } catch (e) {
    // Always ack (2xx) so Pub/Sub doesn't retry-storm; the hourly cron is the
    // safety net for anything missed.
    console.error('push-triggered sync failed', e)
    return json({ ok: false })
  }
})

export const config: Config = { path: '/api/gmail/push' }
