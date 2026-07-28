import type { Config } from '@netlify/functions'
import * as accounts from '../lib/accounts'
import { handle, HttpError, json } from '../lib/http'
import * as mailbox from '../lib/mailbox'
import { requireSession } from '../lib/session'
import * as store from '../lib/store'

/** Streams one attachment's bytes to the browser (view or download). */
export default handle(async (req) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  const userId = requireSession(req)

  const params = new URL(req.url).searchParams
  const id = params.get('id') ?? ''
  const ref = params.get('ref') ?? ''
  if (!id || !ref) throw new HttpError(400, 'Missing attachment reference')

  const email = await store.getUserEmail(id, userId)
  const acc = await accounts.getUserAccount(email.accountId, userId)
  const file = await mailbox.getAttachment(acc, store.providerIdOf(email), ref)

  const inline = /^(image\/|application\/pdf|text\/plain)/.test(file.mimeType)
  return new Response(new Uint8Array(file.content), {
    status: 200,
    headers: {
      'Content-Type': file.mimeType,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${file.name.replace(/["\\]/g, '')}"`,
      'Cache-Control': 'private, no-store',
    },
  })
})

export const config: Config = { path: '/api/attachment' }
