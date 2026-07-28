import type { Config } from '@netlify/functions'
import type { DraftResult } from '../../shared/types'
import * as accounts from '../lib/accounts'
import { handle, HttpError, json, readJson } from '../lib/http'
import { llmJson } from '../lib/llm'
import { composeEmailPrompt } from '../lib/prompts'
import { requireSession } from '../lib/session'
import * as store from '../lib/store'
import { getStyleOrBuild } from '../lib/style-core'
import { todayIn } from '../lib/sync-core'

export default handle(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const userId = requireSession(req)

  const { instruction, accountId } = await readJson<{ instruction: string; accountId?: string }>(req)
  if (typeof instruction !== 'string' || instruction.trim() === '') {
    throw new HttpError(400, 'Tell me what the email should say')
  }

  const settings = await store.getSettings(userId)
  const today = todayIn(settings.timezone)

  // Voice: the chosen account's style, else the first account's, else none.
  const all = await accounts.listAccounts(userId)
  const acc = (typeof accountId === 'string' && all.find((a) => a.id === accountId)) || all[0]
  const { profile, examples } = acc
    ? await getStyleOrBuild(acc.id)
    : { profile: null, examples: [] as string[] }

  const draft = await llmJson<{ to?: string; subject: string; body: string }>(
    composeEmailPrompt({
      instruction: instruction.trim(),
      style: profile,
      examples,
      today,
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

  const result: DraftResult = {
    to: typeof draft.to === 'string' ? draft.to.trim() : '',
    subject: draft.subject,
    body: draft.body,
  }
  return json(result)
})

export const config: Config = { path: '/api/draft/compose' }
