// Demo mode — realistic sample data for design review and safe demos.
// Active ONLY when VITE_DEMO=1 (npm run dev:demo). The check in main.tsx is
// statically replaced at build time, so none of this ships in production.
import type {
  AppSettings,
  AuthStatus,
  DigestRecord,
  EmailDetail,
  EmailSummary,
  MailAccount,
  SyncResult,
} from '../../shared/types'

const now = Date.now()
const H = 3600_000
const iso = (msAgo: number) => new Date(now - msAgo).toISOString()

const CATEGORIES = [
  { key: 'client', label: 'Client', color: '#2563EB', description: 'Clients and prospects' },
  { key: 'government', label: 'Government & Bilateral', color: '#7C3AED', description: 'Ministries, free zones, official bodies' },
  { key: 'finance', label: 'Finance & Invoices', color: '#059669', description: 'Invoices, payments, banking' },
  { key: 'internal', label: 'Internal', color: '#475569', description: 'Company staff and operations' },
  { key: 'vendor', label: 'Vendor & Sales', color: '#EA580C', description: 'Suppliers and salespeople' },
  { key: 'newsletter', label: 'Newsletters', color: '#0891B2', description: 'Digests and broadcasts' },
  { key: 'system', label: 'System', color: '#6B7280', description: 'Automated notifications' },
  { key: 'personal', label: 'Personal', color: '#DB2777', description: 'Family and friends' },
]

const settings: AppSettings = {
  categories: CATEGORIES,
  digestHour: 7,
  timezone: 'Asia/Dubai',
  digestTo: 'walid@dubaiconsultancy.ae',
  llmProvider: 'gemini',
}

const accounts: MailAccount[] = [
  {
    id: 'acc-office',
    kind: 'gmail',
    label: 'Office (bridge)',
    email: 'walid.bridge@gmail.com',
    sendAs: 'walid@dubaiconsultancy.ae',
  },
  {
    id: 'acc-personal',
    kind: 'imap',
    label: 'Personal',
    email: 'walid.personal@outlook.com',
    sendAs: 'walid.personal@outlook.com',
  },
]

// Which demo emails belong to the personal account; everything else is office.
const PERSONAL_IDS = new Set(['d7', 'd10'])
const accountOf = (id: string) => (PERSONAL_IDS.has(id) ? 'acc-personal' : 'acc-office')

interface DemoEmail extends Omit<EmailSummary, 'hasDraft' | 'accountId'> {
  body: string
}

// Auto-drafted replies waiting for review (reply-worthy mail only).
const drafts: Record<string, { subject: string; body: string }> = {
  d1: {
    subject: 'Re: CANEX WKND 2026 — partnership next steps',
    body: 'Dear Ibrahim,\n\nExcellent news — thank you, and please pass my thanks to the committee.\n\nI will review the exhibitor package today and have the signed copy with you before Thursday. The Gold pavilion position works well for us.\n\nBest regards,\nWalid',
  },
  d9: {
    subject: 'Re: Feedback on the sponsorship deck',
    body: 'Dear Amara,\n\nDelighted the board likes the direction. Both revisions are straightforward — we will update the ROI slide with the 2025 actuals and add a tier-2 option for regional brands.\n\nRevised deck with you by Thursday.\n\nWarm regards,\nWalid',
  },
}

const emails: DemoEmail[] = [
  {
    id: 'd1',
    threadId: 't1',
    fromName: 'Ibrahim Osei',
    fromEmail: 'i.osei@afreximbank.com',
    toEmails: ['walid@dubaiconsultancy.ae'],
    subject: 'CANEX WKND 2026 — partnership next steps',
    snippet: 'Dear Walid, following our call last week, the committee has approved…',
    receivedAt: iso(1.2 * H),
    category: 'client',
    tldr: 'Afreximbank approved the partnership; needs signed exhibitor package back by Thursday.',
    participants: ['Ibrahim Osei', 'Afreximbank CANEX committee'],
    deadlines: [{ date: '2026-07-30', what: 'Return signed exhibitor package' }],
    actionRequired: true,
    tasks: ['Review the exhibitor package terms', 'Sign and return before Thursday'],
    isRead: false,
    summarized: true,
    body: 'Dear Walid,\n\nFollowing our call last week, I am pleased to confirm that the committee has approved the partnership framework for CANEX WKND 2026 in Lagos.\n\nTo secure the Gold pavilion position we discussed, we would need the signed exhibitor package back by Thursday, 30 July. The package reflects the revised terms: 96 sqm pavilion, six delegate passes, and speaking slot on the creative-economy panel.\n\nPlease let me know if you would like a short call before signing.\n\nWarm regards,\nIbrahim Osei\nSenior Manager, Export Development\nAfreximbank',
  },
  {
    id: 'd2',
    threadId: 't2',
    fromName: 'Fatima Al Marri',
    fromEmail: 'f.almarri@jafza.ae',
    toEmails: ['walid@dubaiconsultancy.ae'],
    subject: 'Trade license renewal — two documents pending',
    snippet: 'Greetings from JAFZA. Your renewal application is in progress…',
    receivedAt: iso(3 * H),
    category: 'government',
    tldr: 'JAFZA needs the audited financials and tenancy contract to complete the license renewal.',
    participants: ['Fatima Al Marri', 'JAFZA Licensing'],
    deadlines: [{ date: '2026-08-05', what: 'Submit pending renewal documents' }],
    actionRequired: true,
    tasks: ['Send audited financials to JAFZA', 'Send attested tenancy contract'],
    isRead: false,
    summarized: true,
    body: 'Dear Mr. Walid,\n\nGreetings from JAFZA.\n\nYour trade license renewal application (ref. LR-2026-08841) is in progress. Two documents remain outstanding:\n\n1. Audited financial statements for 2025\n2. Attested tenancy contract for the current office\n\nKindly upload both through the customer portal before 5 August to avoid late fees.\n\nBest regards,\nFatima Al Marri\nLicensing Department, JAFZA',
  },
  {
    id: 'd3',
    threadId: 't3',
    fromName: 'UAE Ministry of Economy',
    fromEmail: 'events@moec.gov.ae',
    toEmails: ['walid@dubaiconsultancy.ae'],
    subject: 'Invitation: UAE–Africa Trade Council roundtable, 1 August',
    snippet: 'The Ministry cordially invites you to the quarterly roundtable…',
    receivedAt: iso(5 * H),
    category: 'government',
    tldr: 'Ministry invites you to the UAE–Africa trade roundtable on 1 August; RSVP required.',
    participants: ['Ministry of Economy', 'UAE–Africa Trade Council'],
    deadlines: [{ date: '2026-08-01', what: 'Roundtable at Emirates Towers, RSVP first' }],
    actionRequired: true,
    tasks: ['RSVP for the roundtable'],
    isRead: false,
    summarized: true,
    body: 'Dear Mr. Walid,\n\nThe Ministry of Economy cordially invites you to the quarterly UAE–Africa Trade Council roundtable.\n\nDate: Friday, 1 August 2026\nTime: 10:00 – 12:30\nVenue: Emirates Towers, Godolphin Ballroom\n\nThe session will focus on trade-corridor financing and creative-economy exports. Kindly confirm attendance by replying to this email.\n\nWith regards,\nProtocol Office\nMinistry of Economy',
  },
  {
    id: 'd4',
    threadId: 't4',
    fromName: 'Horizon Media FZ LLC',
    fromEmail: 'accounts@horizonmedia.ae',
    toEmails: ['walid@dubaiconsultancy.ae'],
    subject: 'Invoice HM-2214 — AED 38,500 due 3 August',
    snippet: 'Please find attached invoice HM-2214 for the IATF campaign…',
    receivedAt: iso(8 * H),
    category: 'finance',
    tldr: 'Horizon Media invoice AED 38,500 for the IATF campaign, due 3 August.',
    participants: ['Horizon Media accounts'],
    deadlines: [{ date: '2026-08-03', what: 'Pay invoice HM-2214 (AED 38,500)' }],
    actionRequired: true,
    tasks: ['Approve payment of AED 38,500 to Horizon Media'],
    isRead: true,
    summarized: true,
    body: 'Dear Sir,\n\nPlease find attached invoice HM-2214 for AED 38,500 covering the IATF digital campaign (June–July).\n\nPayment is due by 3 August 2026 to the account listed on the invoice. Kindly share the transfer confirmation when processed.\n\nBest regards,\nAccounts Receivable\nHorizon Media FZ LLC',
  },
  {
    id: 'd5',
    threadId: 't5',
    fromName: 'Sara Mahmoud',
    fromEmail: 'sara@dubaiconsultancy.ae',
    toEmails: ['walid@dubaiconsultancy.ae'],
    subject: 'Weekly operations summary',
    snippet: 'Quick summary before the weekend: three proposals went out…',
    receivedAt: iso(11 * H),
    category: 'internal',
    tldr: 'Weekly ops: three proposals sent, Lagos logistics on track, one hire starting Monday.',
    participants: ['Sara Mahmoud'],
    deadlines: [],
    actionRequired: false,
    tasks: [],
    isRead: true,
    summarized: true,
    body: 'Hi Walid,\n\nQuick summary before the weekend:\n\n• Three proposals went out (Kano AgriTech, Lagos Fashion Week, GITEX follow-up)\n• Lagos travel and freight for CANEX are booked and on budget\n• Amina joins us Monday as project coordinator — onboarding is ready\n\nNothing needs your input today.\n\nSara',
  },
  {
    id: 'd6',
    threadId: 't6',
    fromName: 'Daniel Craven',
    fromEmail: 'd.craven@meridianexhibits.com',
    toEmails: ['walid@dubaiconsultancy.ae'],
    subject: 'Pavilion build quote — IATF 2027 Algiers',
    snippet: 'Thank you for the walkthrough brief. Our quote for the 240 sqm…',
    receivedAt: iso(22 * H),
    category: 'vendor',
    tldr: 'Meridian quotes USD 96k for the 240 sqm IATF pavilion build; valid 30 days.',
    participants: ['Daniel Craven', 'Meridian Exhibits'],
    deadlines: [],
    actionRequired: false,
    tasks: [],
    isRead: true,
    summarized: true,
    body: 'Dear Walid,\n\nThank you for the walkthrough brief. Our quote for the 240 sqm double-deck pavilion at IATF 2027 Algiers comes to USD 96,000 including design, build, and dismantle. The quote is valid for 30 days.\n\nHappy to revise scope if you want to trim the hospitality deck.\n\nBest,\nDaniel Craven\nMeridian Exhibits',
  },
  {
    id: 'd7',
    threadId: 't7',
    fromName: 'Gulf Business Briefing',
    fromEmail: 'newsletter@gulfbusiness.com',
    toEmails: ['walid@dubaiconsultancy.ae'],
    subject: 'Morning brief: non-oil trade up 11%, new visa rules',
    snippet: 'Your daily five-minute read on Gulf markets…',
    receivedAt: iso(26 * H),
    category: 'newsletter',
    tldr: 'Daily briefing: UAE non-oil trade up 11%, new freelance visa rules announced.',
    participants: ['Gulf Business'],
    deadlines: [],
    actionRequired: false,
    tasks: [],
    isRead: true,
    summarized: true,
    body: 'Good morning.\n\nUAE non-oil foreign trade rose 11% in H1. New freelance visa rules take effect in September. Emaar posts record quarter. Full stories on the site.\n\n— Gulf Business Briefing',
  },
  {
    id: 'd8',
    threadId: 't8',
    fromName: 'Google Workspace',
    fromEmail: 'no-reply@google.com',
    toEmails: ['walid@dubaiconsultancy.ae'],
    subject: 'Security alert: new sign-in on Windows',
    snippet: 'We noticed a new sign-in to your Google Account…',
    receivedAt: iso(30 * H),
    category: 'system',
    tldr: 'Routine security notice for a new sign-in on your own laptop.',
    participants: ['Google'],
    deadlines: [],
    actionRequired: false,
    tasks: [],
    isRead: true,
    summarized: true,
    body: 'We noticed a new sign-in to your Google Account on a Windows device. If this was you, no action is needed.\n\n— Google Workspace',
  },
  {
    id: 'd9',
    threadId: 't9',
    fromName: 'Amara Nwosu',
    fromEmail: 'amara@lagosfashionweek.ng',
    toEmails: ['walid@dubaiconsultancy.ae'],
    subject: 'Feedback on the sponsorship deck',
    snippet: 'Walid, the board loved the direction. Two requests before we sign…',
    receivedAt: iso(34 * H),
    category: 'client',
    tldr: 'Lagos Fashion Week board approves direction; wants two deck revisions before signing.',
    participants: ['Amara Nwosu', 'LFW board'],
    deadlines: [],
    actionRequired: true,
    tasks: ['Revise ROI slide with 2025 actuals', 'Add tier-2 sponsor option'],
    isRead: false,
    summarized: true,
    body: 'Walid,\n\nThe board loved the direction of the sponsorship deck. Two requests before we sign:\n\n1. Update the ROI slide with the 2025 actuals you mentioned\n2. Add a smaller tier-2 sponsor option for regional brands\n\nIf we can have the revised deck this week, we can countersign before month-end.\n\nWarmly,\nAmara',
  },
  {
    id: 'd10',
    threadId: 't10',
    fromName: 'Khalid Al Rashid',
    fromEmail: 'khalid.rashid@gmail.com',
    toEmails: ['walid@dubaiconsultancy.ae'],
    subject: 'Dinner Friday?',
    snippet: 'It has been too long! Aisha and I are hosting a small dinner…',
    receivedAt: iso(40 * H),
    category: 'personal',
    tldr: 'Khalid invites you to dinner at his home on Friday evening.',
    participants: ['Khalid Al Rashid'],
    deadlines: [{ date: '2026-07-31', what: 'Dinner at Khalid’s, 8pm' }],
    actionRequired: false,
    tasks: [],
    isRead: true,
    summarized: true,
    body: 'Walid, it has been too long!\n\nAisha and I are hosting a small dinner on Friday at 8 — just old friends, no work talk (I promise). Tell me you can make it.\n\nKhalid',
  },
  {
    id: 'd11',
    threadId: 't11',
    fromName: 'Zoom',
    fromEmail: 'billing@zoom.us',
    toEmails: ['walid@dubaiconsultancy.ae'],
    subject: 'Receipt: Zoom One Pro renewal',
    snippet: 'Thank you for your payment of $149.90…',
    receivedAt: iso(45 * H),
    category: 'system',
    tldr: 'Zoom annual renewal receipt, $149.90 — no action needed.',
    participants: ['Zoom billing'],
    deadlines: [],
    actionRequired: false,
    tasks: [],
    isRead: true,
    summarized: true,
    body: 'Thank you for your payment.\n\nZoom One Pro — annual renewal\nAmount: $149.90\nPayment method: Visa •• 4821\n\nThis is a receipt; no action is required.',
  },
  {
    id: 'd12',
    threadId: 't12',
    fromName: 'Emirates NBD',
    fromEmail: 'alerts@emiratesnbd.com',
    toEmails: ['walid@dubaiconsultancy.ae'],
    subject: 'Your July account statement is ready',
    snippet: 'Dear customer, your statement for account ••2204 is now available…',
    receivedAt: iso(50 * H),
    category: 'finance',
    tldr: 'July bank statement for account ••2204 is available in online banking.',
    participants: ['Emirates NBD'],
    deadlines: [],
    actionRequired: false,
    tasks: [],
    isRead: true,
    summarized: true,
    body: 'Dear customer,\n\nYour statement for account ••2204 (July 2026) is now available in online banking.\n\nEmirates NBD',
  },
]

const digest: DigestRecord = {
  date: new Date(now).toISOString().slice(0, 10),
  emailedAt: iso(2.5 * H),
  content: {
    date: new Date(now).toISOString().slice(0, 10),
    total: 23,
    actionCount: 5,
    byCategory: [
      { key: 'client', label: 'Client', count: 6 },
      { key: 'government', label: 'Government & Bilateral', count: 4 },
      { key: 'finance', label: 'Finance & Invoices', count: 4 },
      { key: 'internal', label: 'Internal', count: 3 },
      { key: 'vendor', label: 'Vendor & Sales', count: 2 },
      { key: 'newsletter', label: 'Newsletters', count: 2 },
      { key: 'system', label: 'System', count: 2 },
    ],
    topItems: [
      { id: 'd1', fromName: 'Ibrahim Osei', subject: 'CANEX WKND 2026 — partnership next steps', tldr: 'Afreximbank approved the partnership; sign the exhibitor package by Thursday.', category: 'client', actionRequired: true },
      { id: 'd2', fromName: 'Fatima Al Marri', subject: 'Trade license renewal — two documents pending', tldr: 'JAFZA needs financials and tenancy contract by 5 August.', category: 'government', actionRequired: true },
      { id: 'd3', fromName: 'Ministry of Economy', subject: 'UAE–Africa Trade Council roundtable', tldr: 'RSVP required for the 1 August roundtable.', category: 'government', actionRequired: true },
      { id: 'd4', fromName: 'Horizon Media', subject: 'Invoice HM-2214', tldr: 'AED 38,500 due 3 August for the IATF campaign.', category: 'finance', actionRequired: true },
      { id: 'd9', fromName: 'Amara Nwosu', subject: 'Feedback on the sponsorship deck', tldr: 'Two revisions requested before LFW signs.', category: 'client', actionRequired: true },
    ],
    deadlines: [
      { date: '2026-07-30', what: 'Return signed CANEX exhibitor package', subject: 'CANEX WKND 2026 — partnership next steps' },
      { date: '2026-08-01', what: 'Trade Council roundtable (RSVP)', subject: 'UAE–Africa Trade Council roundtable' },
      { date: '2026-08-03', what: 'Pay invoice HM-2214 (AED 38,500)', subject: 'Invoice HM-2214' },
      { date: '2026-08-05', what: 'Submit JAFZA renewal documents', subject: 'Trade license renewal' },
    ],
    narrative:
      'A busy 24 hours dominated by client and government matters. The Afreximbank partnership is approved and only needs your signature by Thursday — that is the day’s most valuable item. JAFZA’s license renewal and the Ministry roundtable RSVP are quick wins worth clearing this morning.',
  },
}

const authStatus: AuthStatus = {
  authed: true,
  accountCount: accounts.length,
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

export function installDemo(): void {
  const original = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (!url.startsWith('/api/')) return original(input, init)
    const [path, query] = url.split('?')
    const params = new URLSearchParams(query ?? '')

    await delay(200)

    if (path === '/api/login') return json({ ok: true })
    if (path === '/api/auth/status') return json(authStatus)

    if (path === '/api/accounts') {
      if (init?.method === 'POST') {
        await delay(1200)
        const b = JSON.parse(String(init.body)) as { label?: string; email?: string; sendAs?: string }
        const created: MailAccount = {
          id: 'acc-' + Math.random().toString(36).slice(2, 8),
          kind: 'imap',
          label: b.label || b.email || 'New account',
          email: b.email || '',
          sendAs: b.sendAs || b.email || '',
        }
        accounts.push(created)
        return json(created, 201)
      }
      return json(accounts)
    }

    const accountMatch = path.match(/^\/api\/accounts\/([^/]+)$/)
    if (accountMatch) {
      const acc = accounts.find((a) => a.id === decodeURIComponent(accountMatch[1]))
      if (!acc) return json({ error: 'Mail account not found' }, 404)
      if (init?.method === 'DELETE') {
        accounts.splice(accounts.indexOf(acc), 1)
        return json({ ok: true })
      }
      if (init?.method === 'PUT') {
        const b = JSON.parse(String(init.body)) as { label?: string; sendAs?: string }
        if (b.label !== undefined) acc.label = b.label
        if (b.sendAs !== undefined) acc.sendAs = b.sendAs
        return json(acc)
      }
      return json(acc)
    }

    if (path === '/api/emails') {
      const cat = params.get('category')
      const account = params.get('account')
      const list: EmailSummary[] = emails
        .filter((e) => !cat || e.category === cat)
        .filter((e) => !account || accountOf(e.id) === account)
        .map(({ body: _body, ...rest }) => ({
          ...rest,
          accountId: accountOf(rest.id),
          hasDraft: Boolean(drafts[rest.id]),
        }))
      return json(list)
    }

    const detailMatch = path.match(/^\/api\/emails\/([^/]+)$/)
    if (detailMatch) {
      const e = emails.find((x) => x.id === decodeURIComponent(detailMatch[1]))
      if (!e) return json({ error: 'Email not found' }, 404)
      e.isRead = true
      const detail: EmailDetail = {
        ...e,
        accountId: accountOf(e.id),
        isRead: true,
        hasDraft: Boolean(drafts[e.id]),
        draft: drafts[e.id] ?? null,
      }
      return json(detail)
    }

    if (path === '/api/sync') {
      const result: SyncResult = { newEmails: 0, summarized: 0, drafted: 0, pending: 0 }
      return json(result)
    }

    if (path === '/api/draft/reply') {
      await delay(900)
      const body = init?.body ? (JSON.parse(String(init.body)) as { id: string }) : null
      const original_ = emails.find((x) => x.id === body?.id) ?? emails[0]
      return json({
        to: original_.fromEmail,
        subject: `Re: ${original_.subject}`,
        body: `Dear ${original_.fromName.split(' ')[0]},\n\nThank you for this — good news indeed.\n\nI will review the package today and have the signed copy back to you before Thursday. If anything needs a quick word, my line is open.\n\nBest regards,\nWalid`,
      })
    }

    if (path === '/api/draft/compose') {
      await delay(900)
      return json({
        to: '',
        subject: 'Tuesday’s call — confirmed',
        body: 'Dear team,\n\nConfirming our call on Tuesday at 3:00 pm Gulf time. We will cover the exhibitor package and the pavilion timeline.\n\nPlease share the agenda a day ahead if possible.\n\nBest regards,\nWalid',
      })
    }

    if (path === '/api/send') {
      await delay(700)
      return json({ ok: true, id: 'demo-send' })
    }

    if (path === '/api/digest/today') return json({ digest })
    if (path === '/api/digest/run') return json({ ok: true, sent: true })

    if (path === '/api/settings') {
      if (init?.method === 'PUT') {
        await delay(400)
        return json(JSON.parse(String(init.body)))
      }
      return json(settings)
    }

    if (path === '/api/style/refresh') {
      await delay(1200)
      return json({ ok: true, sampleCount: 23 })
    }

    return json({ error: `No demo handler for ${path}` }, 404)
  }
  console.info('[demo] Zoryxa Mail demo mode active — API calls are mocked')
}
