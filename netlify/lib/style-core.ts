import type { StyleProfile } from '../../shared/types'
import * as gmail from './gmail'
import { HttpError } from './http'
import { llmJson } from './llm'
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
 * Learns the CEO's writing style from recent sent mail, persists it, and
 * returns the profile plus a few real example bodies for few-shot prompting.
 */
export async function buildStyleProfile(): Promise<{
  profile: StyleProfile
  examples: string[]
  sampleCount: number
}> {
  const samples = await gmail.listSentSamples()
  if (samples.length === 0) {
    throw new HttpError(409, 'No sent mail found to learn from yet — send a few emails first')
  }
  const raw = await llmJson<StyleProfile>(stylePrompt(samples), { maxTokens: 800 })
  const profile = normalizeProfile(raw)
  const examples = samples.slice(0, 3).map((s) => s.body.slice(0, 800))
  await store.saveStyle(profile, examples)
  return { profile, examples, sampleCount: samples.length }
}

/**
 * Returns the stored style profile, building one on the fly if none exists.
 * Drafting must work even before any style exists, so build failures degrade
 * to a null profile instead of throwing.
 */
export async function getStyleOrBuild(): Promise<{
  profile: StyleProfile | null
  examples: string[]
}> {
  const existing = await store.getStyle()
  if (existing) return { profile: existing.profile, examples: existing.examples }
  try {
    const built = await buildStyleProfile()
    return { profile: built.profile, examples: built.examples }
  } catch (e) {
    console.error('style build failed, drafting without profile', e)
    return { profile: null, examples: [] }
  }
}
