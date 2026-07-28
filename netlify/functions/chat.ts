import type { Config } from '@netlify/functions'
import type { ChatMessage } from '../../shared/types'
import * as accounts from '../lib/accounts'
import { handle, HttpError, json, readJson } from '../lib/http'
import { llmText } from '../lib/llm'
import * as mailbox from '../lib/mailbox'
import { requireSession } from '../lib/session'
import * as store from '../lib/store'

const SYSTEM = `You are Zoryxa AI, the executive email intelligence inside Zoryxa Mail.
You help a busy executive think about their mail: feasibility, risk, negotiation angles, priorities, what to reply and how, what to ignore.
Style: direct, sharp, concise — an elite chief of staff. Use short paragraphs or tight bullet lists. Give a clear judgment, then the reasoning. Never invent facts that are not in the provided mail context; if something is unknown, say what you'd need to know. Plain text only, no markdown headers.`

/** Free-form AI chat, grounded in the user's own mail. */
export default handle(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const userId = requireSession(req)

  const body = await readJson<{ messages: ChatMessage[]; emailId?: string }>(req)
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    throw new HttpError(400, 'Ask me something first')
  }
  const messages = body.messages
    .filter(
      (m): m is ChatMessage =>
        !!m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim() !== '',
    )
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    throw new HttpError(400, 'Ask me something first')
  }

  // Ground the conversation in the user's actual mail.
  let context: string
  if (typeof body.emailId === 'string' && body.emailId.trim() !== '') {
    const email = await store.getUserEmail(body.emailId, userId)
    const acc = await accounts.getAccount(email.accountId)
    let fullBody = email.snippet
    if (acc) {
      try {
        fullBody = await mailbox.getBody(acc, store.providerIdOf(email))
      } catch {
        /* snippet fallback */
      }
    }
    context = `The conversation is about this specific email:
From: ${email.fromName} <${email.fromEmail}>
Received: ${email.receivedAt}
Subject: ${email.subject}
AI summary: ${email.tldr ?? '(not summarized yet)'}
Action required: ${email.actionRequired ? 'yes' : 'no'}${email.tasks.length ? `\nTasks: ${email.tasks.join('; ')}` : ''}${email.deadlines.length ? `\nDeadlines: ${email.deadlines.map((d) => `${d.date} — ${d.what}`).join('; ')}` : ''}
Full email:
${fullBody.slice(0, 5000)}`
  } else {
    const recent = await store.listEmails({ userId, limit: 25 })
    context =
      recent.length === 0
        ? 'The user has no synced mail yet.'
        : `Recent inbox overview (newest first):\n${recent
            .map(
              (e) =>
                `- ${e.fromName} | ${e.subject} | ${e.tldr ?? e.snippet.slice(0, 80)}${e.actionRequired ? ' | NEEDS ACTION' : ''}${e.deadlines.length ? ` | deadline ${e.deadlines[0].date}` : ''}`,
            )
            .join('\n')}`
  }

  const transcript = messages
    .map((m) => (m.role === 'user' ? `Executive: ${m.content}` : `Zoryxa AI: ${m.content}`))
    .join('\n\n')

  const settings = await store.getSettings(userId)
  const reply = await llmText(
    `MAIL CONTEXT\n${context}\n\nCONVERSATION\n${transcript}\n\nZoryxa AI:`,
    { system: SYSTEM, maxTokens: 700, temperature: 0.5, provider: settings.llmProvider },
  )

  return json({ reply: reply.trim() })
})

export const config: Config = { path: '/api/chat' }
