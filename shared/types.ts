// Shared contracts between the PWA (src/) and the serverless API (netlify/).
// Keep this file dependency-free: types only.

export interface Category {
  key: string
  label: string
  color: string // hex, used for chips/badges via inline style
  description: string // fed to the LLM to guide categorization
}

export interface Deadline {
  date: string // 'YYYY-MM-DD' when resolvable, otherwise the raw phrase
  what: string
}

export interface EmailSummary {
  gmailId: string
  threadId: string
  fromName: string
  fromEmail: string
  toEmails: string[]
  subject: string
  snippet: string
  receivedAt: string // ISO timestamp
  category: string // Category.key, or 'uncategorized' before summarization
  tldr: string | null
  participants: string[]
  deadlines: Deadline[]
  actionRequired: boolean
  tasks: string[]
  isRead: boolean
  summarized: boolean
  hasDraft: boolean // an AI reply draft is waiting (auto-drafted for reply-worthy mail)
}

export interface EmailDetail extends EmailSummary {
  body: string // fetched live from Gmail, never persisted
  draft: { subject: string; body: string } | null // pre-written reply, if any
}

export interface DraftResult {
  to?: string
  cc?: string
  subject: string
  body: string
}

export interface DigestItem {
  gmailId: string
  fromName: string
  subject: string
  tldr: string
  category: string
  actionRequired: boolean
}

export interface DigestContent {
  date: string // 'YYYY-MM-DD' in the configured timezone
  total: number
  actionCount: number
  byCategory: { key: string; label: string; count: number }[]
  topItems: DigestItem[]
  deadlines: (Deadline & { subject: string })[]
  narrative: string // 2-3 sentence executive brief
}

export interface DigestRecord {
  date: string
  content: DigestContent
  emailedAt: string | null
}

export interface AppSettings {
  categories: Category[]
  digestHour: number // 0-23, local to `timezone`
  timezone: string // IANA, e.g. 'Asia/Dubai'
  digestTo: string // where the morning digest email is sent (the CEO)
  sendAs: string // the "Send mail as" alias used as From on outgoing mail
  llmProvider: 'gemini' | 'groq'
}

export interface AuthStatus {
  authed: boolean
  gmailConnected: boolean
  grantedEmail: string | null
}

export interface SyncResult {
  skipped?: boolean
  newEmails: number
  summarized: number
  drafted: number // auto-drafts written this run for reply-worthy mail
  pending: number // emails still awaiting summarization (caller may re-invoke)
}

export interface StyleProfile {
  greetings: string[]
  signoffs: string[]
  tone: string
  formality: string
  sentenceStyle: string
  commonPhrases: string[]
  notes: string
}
