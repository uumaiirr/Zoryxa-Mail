import type { StyleProfile } from '../../shared/types'
import { getAccount } from './accounts'
import { HttpError } from './http'
import { llmJson } from './llm'
import * as mailbox from './mailbox'
import { stylePrompt } from './prompts'
import * as store from './store'

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : []
}

/** Coerce whatever the model returned into a well-formed StyleProfile. */
function normalizeProfile(raw: unknown): StyleProfile {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    greetings: asStringArray(r.greetings),
    signoffs: asStringArray(r.signoffs),
    tone: asString(r.tone),
    formality: asString(r.formality),
    sentenceStyle: asString(r.sentenceStyle),
    commonPhrases: asStringArray(r.commonPhrases),
    notes: asString(r.notes),
  }
}

/**
 * Learns one account owner's writing style from their recent sent mail,
 * persists it, and returns the profile plus example bodies for few-shot use.
 */
export async function buildStyleProfile(accountId: string): Promise<{
  profile: StyleProfile
  examples: string[]
  sampleCount: number
}> {
  const acc = await getAccount(accountId)
  if (!acc) throw new HttpError(404, 'Mail account not found')
  const samples = await mailbox.sentSamples(acc)
  if (samples.length === 0) {
    throw new HttpError(
      409,
      `No sent mail found for ${acc.email} yet — send a few emails first (IMAP accounts need a "Sent" folder)`,
    )
  }
  const raw = await llmJson<StyleProfile>(stylePrompt(samples), { maxTokens: 800 })
  const profile = normalizeProfile(raw)
  const examples = samples.slice(0, 3).map((s) => s.body.slice(0, 800))
  await store.saveStyle(accountId, profile, examples)
  return { profile, examples, sampleCount: samples.length }
}

/**
 * Returns the account's stored style, building it on first use. Drafting must
 * work even with no style yet, so build failures degrade to a null profile.
 */
export async function getStyleOrBuild(accountId: string): Promise<{
  profile: StyleProfile | null
  examples: string[]
}> {
  const existing = await store.getStyle(accountId)
  if (existing) return { profile: existing.profile, examples: existing.examples }
  try {
    const built = await buildStyleProfile(accountId)
    return { profile: built.profile, examples: built.examples }
  } catch (e) {
    console.error('style build failed, drafting without profile', e)
    return { profile: null, examples: [] }
  }
}
