import type { Config } from '@netlify/functions'
import type { DraftResult } from '../../shared/types'
import * as accounts from '../lib/accounts'
import { handle, HttpError, json, readJson } from '../lib/http'
import { llmJson } from '../lib/llm'
import * as mailbox from '../lib/mailbox'
import { replyPrompt } from '../lib/prompts'
import { requireSession } from '../lib/session'
import * as store from '../lib/store'
import { getStyleOrBuild } from '../lib/style-core'

export default handle(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const userId = requireSession(req)

  const { id, instruction } = await readJson<{ id: string; instruction?: string }>(req)
  if (typeof id !== 'string' || id.trim() === '') {
    throw new HttpError(400, 'Missing email id')
  }

  const original = await store.getUserEmail(id, userId)
  const acc = await accounts.getUserAccount(original.accountId, userId)

  let body = original.snippet
  try {
    body = await mailbox.getBody(acc, store.providerIdOf(original))
  } catch (e) {
    console.error('body fetch failed, drafting from snippet', id, e)
  }

  const { profile, examples } = await getStyleOrBuild(acc.id)

  const draft = await llmJson<{ subject: string; body: string }>(
    replyPrompt({
      fromName: original.fromName,
      fromEmail: original.fromEmail,
      subject: original.subject,
      date: original.receivedAt,
      body: (body || original.subject).slice(0, 6000),
      instruction: typeof instruction === 'string' && instruction.trim() ? instruction.trim() : undefined,
      style: profile,
      examples,
    }),
    { maxTokens: 900 },
  )

  if (
    typeof draft?.subject !== 'string' ||
    draft.subject.trim() === '' ||
    typeof draft?.body !== 'string' ||
    draft.body.trim() === ''
  ) {
    throw new HttpError(502, 'The assistant returned an unusable draft — please try again')
  }

  const result: DraftResult = { to: original.fromEmail, subject: draft.subject, body: draft.body }
  return json(result)
})

export const config: Config = { path: '/api/draft/reply' }
