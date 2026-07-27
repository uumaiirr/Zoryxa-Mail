import type { Config } from '@netlify/functions'
import type { DraftResult } from '../../shared/types'
import * as gmail from '../lib/gmail'
import { handle, HttpError, json, readJson } from '../lib/http'
import { llmJson } from '../lib/llm'
import { replyPrompt } from '../lib/prompts'
import { requireSession } from '../lib/session'
import * as store from '../lib/store'
import { getStyleOrBuild } from '../lib/style-core'

export default handle(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  requireSession(req)

  const { gmailId, instruction } = await readJson<{ gmailId: string; instruction?: string }>(req)
  if (typeof gmailId !== 'string' || gmailId.trim() === '') {
    throw new HttpError(400, 'Missing email id')
  }

  const original = await store.getEmail(gmailId)
  if (!original) throw new HttpError(404, 'Email not found')

  let body = original.snippet
  try {
    body = await gmail.getBody(gmailId)
  } catch (e) {
    console.error('body fetch failed, drafting from snippet', gmailId, e)
  }

  const { profile, examples } = await getStyleOrBuild()

  const draft = await llmJson<{ subject: string; body: string }>(
    replyPrompt({
      fromName: original.fromName,
      fromEmail: original.fromEmail,
      subject: original.subject,
      date: original.receivedAt,
      body: body.slice(0, 6000),
      instruction: typeof instruction === 'string' && instruction.trim() ? instruction.trim() : undefined,
      style: profile,
      examples,
    }),
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
