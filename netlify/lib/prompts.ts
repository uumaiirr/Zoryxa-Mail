import type { Category, StyleProfile } from '../../shared/types'

export const DEFAULT_CATEGORIES: Category[] = [
  {
    key: 'client',
    label: 'Client',
    color: '#2563EB',
    description: 'Emails from or about clients and prospects: proposals, ongoing projects, meetings, deliverables',
  },
  {
    key: 'government',
    label: 'Government & Bilateral',
    color: '#7C3AED',
    description: 'Ministries, embassies, free zones, government bodies, bilateral trade councils, official or diplomatic correspondence',
  },
  {
    key: 'finance',
    label: 'Finance & Invoices',
    color: '#059669',
    description: 'Invoices, payments, banking, accounting, financial statements, payment reminders',
  },
  {
    key: 'internal',
    label: 'Internal',
    color: '#475569',
    description: 'Emails from company staff and about internal operations, HR, admin',
  },
  {
    key: 'vendor',
    label: 'Vendor & Sales',
    color: '#EA580C',
    description: 'Suppliers, vendors, and people selling products or services to the company (cold outreach included)',
  },
  {
    key: 'newsletter',
    label: 'Newsletters',
    color: '#0891B2',
    description: 'Newsletters, digests, marketing broadcasts, event promotions, mailing lists',
  },
  {
    key: 'system',
    label: 'System',
    color: '#6B7280',
    description: 'Automated notifications: receipts, security alerts, no-reply system mail, calendar notifications',
  },
  {
    key: 'personal',
    label: 'Personal',
    color: '#DB2777',
    description: 'Personal, non-business correspondence from family and friends',
  },
]

export interface SummarizeInput {
  index: number
  from: string
  subject: string
  date: string
  body: string
}

/**
 * Batch summarization + categorization. The model must answer with a JSON
 * OBJECT {"results": [...]} (object root required by Groq's json_object mode).
 */
export function summarizeBatchPrompt(
  emails: SummarizeInput[],
  categories: Category[],
  today: string,
): string {
  return `You are the executive email analyst for a company CEO. Today is ${today}.
Analyze the ${emails.length} email(s) below and respond with JSON only.

Respond with a JSON object of this exact shape:
{"results": [one object per email, in the same order]}

Each object in "results" must have exactly these keys:
- "index": the email's index number exactly as given
- "tldr": one plain sentence, maximum 20 words, saying what the email is about and what it wants
- "category": exactly one of the category keys listed below
- "participants": array of key people/organisations involved (names preferred over raw addresses), max 6
- "deadlines": array of {"date": "YYYY-MM-DD" when resolvable relative to today, otherwise the literal phrase, "what": short description}; [] if none
- "actionRequired": true only if the CEO must reply, decide, approve, pay, attend, or delegate something; false for FYI, newsletters, receipts
- "tasks": array of short imperative phrases describing what the CEO must do; [] if none
- "suggestReply": true ONLY if this email genuinely deserves a written reply from the CEO himself — a direct question, a request needing his answer, an approval, an invitation, or an important relationship to maintain. False for invoices to pay, newsletters, receipts, automated mail, and anything a reply would not serve
- "newCategory": ONLY when no existing category fits well, set "category" to "new" and provide {"label": short 1-3 word name, "description": one line of what belongs there}. Otherwise omit this key entirely. You own this taxonomy — organize the mailbox the way an elite chief of staff would.

Category keys:
${categories.map((c) => `- "${c.key}" (${c.label}): ${c.description}`).join('\n')}

Rules: use "category" values EXACTLY from the list (or "new" with "newCategory" as described). Be terse and factual. Do not invent deadlines. Respond with ONLY the JSON object.

Emails:
${emails
  .map(
    (e) => `--- EMAIL index=${e.index} ---
From: ${e.from}
Date: ${e.date}
Subject: ${e.subject}
Body:
${e.body}`,
  )
  .join('\n\n')}`
}

export interface TriageInput {
  index: number
  from: string
  subject: string
  date: string
  preview: string
}

/**
 * CHEAP pass over many emails at once — metadata + preview only, no bodies.
 * Sorts the mailbox (category, priority, spam, reply-worthiness) without
 * spending real AI budget. Deep analysis happens when an email is opened.
 */
export function triagePrompt(
  emails: TriageInput[],
  categories: Category[],
  today: string,
): string {
  return `You are the executive mail triage for a company CEO. Today is ${today}.
Sort the ${emails.length} email(s) below. Respond with JSON only.

Respond with a JSON object: {"results": [one object per email, same order]}
Each object has exactly:
- "index": the email's index number exactly as given
- "category": exactly one of the category keys below, or "new" with "newCategory"
- "newCategory": ONLY when nothing fits — {"label": 1-3 word name, "description": one line}. You own this taxonomy; organize like an elite chief of staff.
- "priority": "high" (needs the CEO personally and soon), "normal", "low" (newsletters, receipts, FYI), or "spam" (unsolicited marketing, phishing, junk)
- "actionRequired": true if he must reply, decide, approve, pay, attend, or delegate
- "suggestReply": true only if it genuinely deserves a written reply from him

Category keys:
${categories.map((c) => `- "${c.key}" (${c.label}): ${c.description}`).join('\n')}

Judge from sender, subject, and preview. Be decisive. Respond with ONLY the JSON object.

Emails:
${emails
  .map(
    (e) => `--- index=${e.index} ---
From: ${e.from}
Date: ${e.date}
Subject: ${e.subject}
Preview: ${e.preview}`,
  )
  .join('\n\n')}`
}

/**
 * DEEP pass for ONE email the CEO just opened: full summary plus, when it
 * deserves one, a ready reply in his voice. Single call, single email.
 */
export function analyzePrompt(args: {
  fromName: string
  fromEmail: string
  subject: string
  date: string
  body: string
  today: string
  wantsDraft: boolean
  style: StyleProfile | null
  examples: string[]
}): string {
  return `You are the executive email analyst for a company CEO. Today is ${args.today}.
Analyze this ONE email and respond with JSON only.

Respond with a JSON object with exactly these keys:
- "tldr": one plain sentence, max 20 words, saying what it is about and what it wants
- "participants": array of key people/organisations involved, max 6
- "deadlines": array of {"date": "YYYY-MM-DD" when resolvable relative to today, else the literal phrase, "what": short description}; [] if none
- "actionRequired": true only if the CEO must reply, decide, approve, pay, attend, or delegate
- "tasks": array of short imperative phrases for the CEO; [] if none
${
  args.wantsDraft
    ? `- "draft": {"subject": "Re: ...", "body": "..."} — a complete reply IN THE CEO'S VOICE, ready to send: greeting, message, sign-off. Plain text, no markdown, no placeholders. NEVER invent commitments, amounts, or dates not present in the email.`
    : `- "draft": null`
}

${styleBlockFor(args.style, args.examples)}
Email:
From: ${args.fromName} <${args.fromEmail}>
Date: ${args.date}
Subject: ${args.subject}
Body:
${args.body}`
}

export function stylePrompt(samples: { to: string; subject: string; body: string }[]): string {
  return `You are a writing analyst. Below are ${samples.length} emails a CEO actually wrote and sent. Study how he writes and respond with JSON only.

Respond with a JSON object with exactly these keys:
- "greetings": array of the greeting formulas he actually uses (e.g. "Dear X,", "Hi X,"), most frequent first
- "signoffs": array of his actual sign-offs including how he signs his name, most frequent first
- "tone": one sentence describing his overall tone
- "formality": one of "very formal", "formal", "neutral", "casual"
- "sentenceStyle": one sentence on sentence length and structure (terse vs detailed, bullet use, paragraph length)
- "commonPhrases": array of distinctive words/phrases he reuses, max 10
- "notes": anything else important for imitating him (punctuation habits, greetings in other languages, how he handles requests)

Sent emails:
${samples
  .map(
    (s, i) => `--- SENT ${i + 1} ---
To: ${s.to}
Subject: ${s.subject}
${s.body}`,
  )
  .join('\n\n')}`
}

export function styleBlockFor(style: StyleProfile | null, examples: string[]): string {
  return styleBlock(style, examples)
}

function styleBlock(style: StyleProfile | null, examples: string[]): string {
  let block = ''
  if (style) {
    block += `The CEO's writing style profile — imitate it closely:
${JSON.stringify(style, null, 2)}
`
  }
  if (examples.length > 0) {
    block += `
Real examples of emails the CEO wrote (match this voice):
${examples.map((e, i) => `--- EXAMPLE ${i + 1} ---\n${e}`).join('\n\n')}
`
  }
  return block
}

export function replyPrompt(args: {
  fromName: string
  fromEmail: string
  subject: string
  date: string
  body: string
  instruction?: string
  style: StyleProfile | null
  examples: string[]
}): string {
  return `You draft email replies for a company CEO. Write a reply IN THE CEO'S VOICE to the email below. Respond with JSON only.

${styleBlock(args.style, args.examples)}
${
  args.instruction
    ? `The CEO's instruction for this reply: ${args.instruction}`
    : 'No specific instruction was given — write the most appropriate, professional reply.'
}

Respond with a JSON object: {"subject": "...", "body": "..."}
- "subject" should normally be "Re: <original subject>" unless a change is clearly better.
- "body" is plain text, ready to send: greeting, message, sign-off. No markdown, no placeholders like [Name] — if the recipient's name is known, use it.
- NEVER invent commitments, amounts, dates, or facts that are not in the original email or the CEO's instruction.
- Keep it as short as the CEO's style allows.

Original email:
From: ${args.fromName} <${args.fromEmail}>
Date: ${args.date}
Subject: ${args.subject}
Body:
${args.body}`
}

export function composeEmailPrompt(args: {
  instruction: string
  style: StyleProfile | null
  examples: string[]
  today: string
}): string {
  return `You draft emails for a company CEO. Today is ${args.today}. From the short instruction below, write a complete email IN THE CEO'S VOICE. Respond with JSON only.

${styleBlock(args.style, args.examples)}
The CEO's instruction: ${args.instruction}

Respond with a JSON object: {"to": "...", "subject": "...", "body": "..."}
- "to": the recipient email address ONLY if it is explicitly present in the instruction, otherwise ""
- "subject": a clear, specific subject line
- "body": plain text, ready to send: greeting, message, sign-off. No markdown. No invented facts, figures, or dates beyond the instruction.`
}

export function digestNarrativePrompt(args: {
  dateLabel: string
  total: number
  actionCount: number
  byCategory: { label: string; count: number }[]
  topItems: { fromName: string; subject: string; tldr: string }[]
}): string {
  return `You brief a company CEO each morning. Based on the inbox statistics below for ${args.dateLabel}, write a 2-3 sentence executive brief: what dominated the inbox and what genuinely needs his attention first. Plain, direct, no fluff, no greetings. Respond with JSON only: {"narrative": "..."}

Total emails: ${args.total}
Needing action: ${args.actionCount}
By category: ${args.byCategory.map((c) => `${c.label}: ${c.count}`).join(', ')}
Top action items:
${args.topItems.map((t) => `- ${t.fromName}: ${t.subject} — ${t.tldr}`).join('\n')}`
}
