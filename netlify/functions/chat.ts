import type { Config } from '@netlify/functions'
import type { ChatMessage } from '../../shared/types'
import * as accounts from '../lib/accounts'
import { handle, HttpError, json, readJson } from '../lib/http'
import { geminiUploadFile, llmText } from '../lib/llm'
import * as mailbox from '../lib/mailbox'
import { requireSession } from '../lib/session'
import * as store from '../lib/store'
import { db } from '../lib/supabase'

const SYSTEM = `You are Zoryxa AI, the executive email intelligence inside Zoryxa Mail.
You help a busy executive think about their mail: feasibility, risk, negotiation angles, priorities, what to reply and how, what to ignore.
Style: direct, sharp, concise — an elite chief of staff. Use short paragraphs or tight bullet lists. Give a clear judgment, then the reasoning. Never invent facts that are not in the provided mail context; if something is unknown, say what you'd need to know. Plain text only, no markdown headers.`

/** Free-form AI chat, grounded in the user's own mail. */
export default handle(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const userId = requireSession(req)

  const body = await readJson<{
    messages: ChatMessage[]
    emailId?: string
    attachment?: { mimeType: string; dataBase64?: string; storagePath?: string; name?: string }
  }>(req)
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    throw new HttpError(400, 'Ask me something first')
  }

  // Optional image/PDF the user attached (understood like ChatGPT/Gemini).
  // Small files arrive inline; large ones (≤50 MB) came via /api/upload-url
  // into private storage and are handed to Gemini's file store here.
  let attachment: { mimeType: string; dataBase64?: string; fileUri?: string } | undefined
  let attachmentNote = ''
  let cleanupPath: string | null = null
  if (body.attachment) {
    const mt = String(body.attachment.mimeType ?? '')
    if (!/^image\//.test(mt) && mt !== 'application/pdf') {
      throw new HttpError(400, 'Only images and PDF files can be attached')
    }
    if (typeof body.attachment.storagePath === 'string' && body.attachment.storagePath) {
      const path = body.attachment.storagePath
      if (!path.startsWith(`${userId}/`)) throw new HttpError(404, 'Attachment not found')
      const { data, error } = await db().storage.from('ai-uploads').download(path)
      if (error || !data) throw new HttpError(400, 'The attachment upload did not complete — try again')
      const buf = Buffer.from(await data.arrayBuffer())
      if (buf.length > 52_500_000) throw new HttpError(400, 'Attachments must be under 50 MB')
      cleanupPath = path
      attachment = { mimeType: mt, fileUri: await geminiUploadFile(buf, mt) }
    } else {
      const data = String(body.attachment.dataBase64 ?? '')
      if (data.length === 0 || data.length > 5_600_000) {
        throw new HttpError(400, 'Inline attachments must be under 4 MB')
      }
      attachment = { mimeType: mt, dataBase64: data }
    }
    attachmentNote = `\nThe executive attached a file (${body.attachment.name ?? mt}) — analyze it as part of your answer.`
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
    `MAIL CONTEXT\n${context}${attachmentNote}\n\nCONVERSATION\n${transcript}\n\nZoryxa AI:`,
    {
      system: SYSTEM,
      maxTokens: 700,
      temperature: 0.5,
      provider: settings.llmProvider,
      attachment,
    },
  )

  if (cleanupPath) {
    void db().storage.from('ai-uploads').remove([cleanupPath])
  }

  return json({ reply: reply.trim() })
})

export const config: Config = { path: '/api/chat' }
