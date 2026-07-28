import { GoogleGenAI } from '@google/genai'
import Groq from 'groq-sdk'
import { env, optionalEnv } from './env'

// Free-tier defaults, verified July 2026. Both are overridable via env vars.
// Gemini free tier: ~15 RPM / 1,500 requests/day. Groq free tier: 30 RPM / 1,000/day.
const GEMINI_DEFAULT_MODEL = 'gemini-3.5-flash'
const GROQ_DEFAULT_MODEL = 'llama-3.3-70b-versatile'

export class LlmError extends Error {}

export interface LlmOpts {
  system?: string
  json?: boolean
  maxTokens?: number
  temperature?: number
  /** Per-user provider choice; falls back to the LLM_PROVIDER env default. */
  provider?: 'gemini' | 'groq'
  /** Image or PDF understanding (Gemini only — the call auto-routes there). */
  attachment?: { mimeType: string; dataBase64: string }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function statusOf(e: any): number | undefined {
  if (typeof e?.status === 'number') return e.status
  if (typeof e?.response?.status === 'number') return e.response.status
  return undefined
}

/**
 * Retries on free-tier rate limits (429) and transient provider errors with
 * exponential backoff + jitter, so bursts queue instead of crashing.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let last: unknown
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      const status = statusOf(e)
      const msg = String((e as Error)?.message ?? e)
      const retriable =
        status === 429 ||
        (status !== undefined && status >= 500) ||
        /rate.?limit|quota|overloaded|unavailable|resource.?exhausted/i.test(msg)
      if (!retriable || attempt === 3) throw e
      const delay = Math.min(2000 * 2 ** attempt, 15000) + Math.random() * 1000
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw last
}

let geminiClient: GoogleGenAI | null = null
let groqClient: Groq | null = null

async function geminiCall(prompt: string, opts: LlmOpts): Promise<string> {
  if (!geminiClient) geminiClient = new GoogleGenAI({ apiKey: env('GEMINI_API_KEY') })
  const contents = opts.attachment
    ? [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: opts.attachment.mimeType,
                data: opts.attachment.dataBase64,
              },
            },
          ],
        },
      ]
    : prompt
  const res = await geminiClient.models.generateContent({
    model: optionalEnv('GEMINI_MODEL') ?? GEMINI_DEFAULT_MODEL,
    contents,
    config: {
      ...(opts.system ? { systemInstruction: opts.system } : {}),
      temperature: opts.temperature ?? 0.4,
      maxOutputTokens: opts.maxTokens ?? 2048,
      ...(opts.json ? { responseMimeType: 'application/json' } : {}),
    },
  })
  const text = res.text
  if (!text) throw new LlmError('Empty response from Gemini')
  return text
}

async function groqCall(prompt: string, opts: LlmOpts): Promise<string> {
  if (opts.attachment) {
    throw new LlmError('Attachments are answered by Gemini — this should have auto-routed')
  }
  if (!groqClient) groqClient = new Groq({ apiKey: env('GROQ_API_KEY') })
  const res = await groqClient.chat.completions.create({
    model: optionalEnv('GROQ_MODEL') ?? GROQ_DEFAULT_MODEL,
    messages: [
      ...(opts.system ? [{ role: 'system' as const, content: opts.system }] : []),
      { role: 'user' as const, content: prompt },
    ],
    temperature: opts.temperature ?? 0.4,
    // Groq counts max_tokens against its TPM admission budget — keep it lean.
    max_tokens: opts.maxTokens ?? 2048,
    ...(opts.json ? { response_format: { type: 'json_object' as const } } : {}),
  })
  const text = res.choices[0]?.message?.content
  if (!text) throw new LlmError('Empty response from Groq')
  return text
}

export async function llmText(prompt: string, opts: LlmOpts = {}): Promise<string> {
  let provider = opts.provider ?? (process.env.LLM_PROVIDER === 'groq' ? 'groq' : 'gemini')
  // Vision/PDF understanding lives on Gemini — route attachments there.
  if (opts.attachment) provider = 'gemini'
  const call = provider === 'groq' ? groqCall : geminiCall
  return withRetry(() => call(prompt, opts))
}

/**
 * JSON-mode call. Prompts MUST ask for a JSON *object* at the root (Groq's
 * json_object mode rejects bare arrays) and must contain the word "JSON".
 */
export async function llmJson<T>(prompt: string, opts: LlmOpts = {}): Promise<T> {
  const raw = await llmText(prompt, { ...opts, json: true })
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
  try {
    return JSON.parse(cleaned) as T
  } catch {
    const m = cleaned.match(/[[{][\s\S]*[\]}]/)
    if (m) {
      try {
        return JSON.parse(m[0]) as T
      } catch {
        /* fall through */
      }
    }
    throw new LlmError('The model returned invalid JSON — please try again')
  }
}
