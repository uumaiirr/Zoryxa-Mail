import type { Config } from '@netlify/functions'
import type { Deadline } from '../../shared/types'
import * as accounts from '../lib/accounts'
import { handle, HttpError, json, readJson } from '../lib/http'
import { llmJson } from '../lib/llm'
import * as mailbox from '../lib/mailbox'
import { analyzePrompt } from '../lib/prompts'
import { requireSession } from '../lib/session'
import * as store from '../lib/store'
import { getStyleOrBuild } from '../lib/style-core'
import { stripQuoted, todayIn } from '../lib/sync-core'

interface AnalyzeOut {
  tldr?: string
  participants?: string[]
  deadlines?: Deadline[]
  actionRequired?: boolean
  tasks?: string[]
  draft?: { subject?: string; body?: string } | null
}

/**
 * Deep AI for ONE email, run when the CEO opens it: summary, tasks, deadlines
 * and — when it deserves one — a reply already written in his voice.
 * Cached: a second open returns the stored analysis instantly.
 */
export default handle(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const userId = requireSession(req)

  const { id, force } = await readJson<{ id: string; force?: boolean }>(req)
  if (typeof id !== 'string' || id.trim() === '') throw new HttpError(400, 'Missing email id')

  const email = await store.getUserEmail(id, userId)
  if (email.analyzed && !force) {
    return json({
      tldr: email.tldr,
      participants: email.participants,
      deadlines: email.deadlines,
      actionRequired: email.actionRequired,
      tasks: email.tasks,
      draft: await store.getDraft(id),
      cached: true,
    })
  }

  const acc = await accounts.getUserAccount(email.accountId, userId)
  let body = email.snippet
  try {
    body = (await mailbox.getBody(acc, store.providerIdOf(email))) || email.snippet
  } catch (e) {
    console.error('analyze body fetch failed, using preview', id, e)
  }

  const settings = await store.getSettings(userId)
  const wantsDraft = email.suggestReply && email.folder === 'inbox'
  const style = wantsDraft ? await getStyleOrBuild(acc.id) : { profile: null, examples: [] }

  const out = await llmJson<AnalyzeOut>(
    analyzePrompt({
      fromName: email.fromName,
      fromEmail: email.fromEmail,
      subject: email.subject,
      date: email.receivedAt,
      body: stripQuoted(body || email.subject).slice(0, 7000),
      today: todayIn(settings.timezone),
      wantsDraft,
      style: style.profile,
      examples: style.examples,
    }),
    { maxTokens: 1200, provider: settings.llmProvider },
  )

  const draft =
    out.draft && typeof out.draft.body === 'string' && out.draft.body.trim()
      ? {
          subject: String(out.draft.subject ?? `Re: ${email.subject}`).slice(0, 300),
          body: out.draft.body,
        }
      : null

  const analysis = {
    tldr: String(out.tldr ?? '').slice(0, 300),
    participants: (out.participants ?? []).map(String).slice(0, 10),
    deadlines: (out.deadlines ?? []).slice(0, 10),
    actionRequired: Boolean(out.actionRequired ?? email.actionRequired),
    tasks: (out.tasks ?? []).map(String).slice(0, 10),
    draft,
  }
  await store.saveAnalysis(id, analysis)
  return json({ ...analysis, cached: false })
})

export const config: Config = { path: '/api/emails/analyze' }
