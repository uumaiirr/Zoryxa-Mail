import type { Config } from '@netlify/functions'
import type { DraftResult } from '../../shared/types'
import { handle, HttpError, json, readJson } from '../lib/http'
import { llmJson } from '../lib/llm'
import { composeEmailPrompt } from '../lib/prompts'
import { requireSession } from '../lib/session'
import * as store from '../lib/store'
import { getStyleOrBuild } from '../lib/style-core'
import { todayIn } from '../lib/sync-core'

export default handle(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  requireSession(req)

  const { instruction } = await readJson<{ instruction: string }>(req)
  if (typeof instruction !== 'string' || instruction.trim() === '') {
    throw new HttpError(400, 'Tell me what the email should say')
  }

  const settings = await store.getSettings()
  const today = todayIn(settings.timezone)
  const { profile, examples } = await getStyleOrBuild()

  const draft = await llmJson<{ to?: string; subject: string; body: string }>(
    composeEmailPrompt({
      instruction: instruction.trim(),
      style: profile,
      examples,
      today,
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

  const result: DraftResult = {
    to: typeof draft.to === 'string' ? draft.to.trim() : '',
    subject: draft.subject,
    body: draft.body,
  }
  return json(result)
})

export const config: Config = { path: '/api/draft/compose' }
