import type { Config } from '@netlify/functions'
import * as accounts from '../lib/accounts'
import { handle, HttpError, json, readJson } from '../lib/http'
import { requireSession } from '../lib/session'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default handle(async (req, context) => {
  requireSession(req)
  const id = decodeURIComponent(context.params.id)
  const acc = await accounts.getAccount(id)
  if (!acc) throw new HttpError(404, 'Mail account not found')

  if (req.method === 'DELETE') {
    await accounts.deleteAccount(id)
    return json({ ok: true })
  }

  if (req.method === 'PUT') {
    const raw = await readJson<{ label?: string; sendAs?: string }>(req)
    const patch: { label?: string; sendAs?: string } = {}
    if (raw.label !== undefined) {
      const label = String(raw.label).trim().slice(0, 60)
      if (!label) throw new HttpError(400, 'The account name cannot be empty')
      patch.label = label
    }
    if (raw.sendAs !== undefined) {
      const sendAs = String(raw.sendAs).trim()
      if (sendAs !== '' && !EMAIL_RE.test(sendAs)) {
        throw new HttpError(400, 'The send-as address does not look valid')
      }
      patch.sendAs = sendAs
    }
    const updated = await accounts.updateAccount(id, patch)
    return json(accounts.toPublic(updated))
  }

  return json({ error: 'Method not allowed' }, 405)
})

export const config: Config = { path: '/api/accounts/:id' }
