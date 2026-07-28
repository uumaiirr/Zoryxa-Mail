import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type {
  AppSettings,
  AuthStatus,
  Category,
  ImapAccountInput,
  MailAccount,
} from '../../shared/types'
import { api, ApiError } from '../lib/api'
import TopBar from '../components/TopBar'

const inputClass =
  'w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold'

function hourLabel(h: number): string {
  const period = h < 12 ? 'AM' : 'PM'
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display}:00 ${period}`
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <section>
      <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted mb-2 mt-5">
        {icon}
        <span>{title}</span>
      </h2>
      <div className="card p-4">{children}</div>
    </section>
  )
}

const sectionIcon = {
  envelope: (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
    </svg>
  ),
  sparkle: (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M12 2l2.1 6.1L20.5 10l-6.4 1.9L12 18l-2.1-6.1L3.5 10l6.4-1.9L12 2z" />
    </svg>
  ),
  tag: (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
      <path d="M7.5 7.5h.01" />
    </svg>
  ),
}

function messageOf(e: unknown): string {
  return e instanceof ApiError ? e.message : 'Something went wrong — please try again.'
}

// Known provider mail servers — typing the email pre-fills everything below.
const O365 = { imapHost: 'outlook.office365.com', imapPort: '993', smtpHost: 'smtp.office365.com', smtpPort: '587' }
const PROVIDER_PRESETS: Record<string, { imapHost: string; imapPort: string; smtpHost: string; smtpPort: string }> = {
  'yahoo.com': { imapHost: 'imap.mail.yahoo.com', imapPort: '993', smtpHost: 'smtp.mail.yahoo.com', smtpPort: '465' },
  'ymail.com': { imapHost: 'imap.mail.yahoo.com', imapPort: '993', smtpHost: 'smtp.mail.yahoo.com', smtpPort: '465' },
  'outlook.com': O365,
  'hotmail.com': O365,
  'live.com': O365,
  'msn.com': O365,
  'icloud.com': { imapHost: 'imap.mail.me.com', imapPort: '993', smtpHost: 'smtp.mail.me.com', smtpPort: '587' },
  'me.com': { imapHost: 'imap.mail.me.com', imapPort: '993', smtpHost: 'smtp.mail.me.com', smtpPort: '587' },
}

function detectServers(
  email: string,
): { imapHost: string; imapPort: string; smtpHost: string; smtpPort: string } | 'gmail' | null {
  const domain = email.split('@')[1]?.trim().toLowerCase()
  if (!domain || !domain.includes('.')) return null
  if (domain === 'gmail.com' || domain === 'googlemail.com') return 'gmail'
  return (
    PROVIDER_PRESETS[domain] ?? {
      imapHost: `mail.${domain}`,
      imapPort: '993',
      smtpHost: `mail.${domain}`,
      smtpPort: '587',
    }
  )
}

const emptyImapForm = {
  label: '',
  email: '',
  imapHost: '',
  imapPort: '993',
  imapUser: '',
  imapPass: '',
  smtpHost: '',
  smtpPort: '587',
  smtpUser: '',
  smtpPass: '',
  sendAs: '',
}

function AccountsSection() {
  const [accounts, setAccounts] = useState<MailAccount[] | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ ...emptyImapForm })
  const [sameCreds, setSameCreds] = useState(true)
  const [detectNote, setDetectNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [styleBusyId, setStyleBusyId] = useState<string | null>(null)
  const [rowMsg, setRowMsg] = useState<Record<string, string>>({})

  const load = () =>
    api
      .accounts()
      .then(setAccounts)
      .catch(() => setAccounts([]))

  useEffect(() => {
    void load()
  }, [])

  function setF(p: Partial<typeof emptyImapForm>) {
    setForm((f) => ({ ...f, ...p }))
  }

  async function addImap() {
    if (busy) return
    setBusy(true)
    setNotice(null)
    try {
      const input: ImapAccountInput = {
        label: form.label.trim() || form.email.trim(),
        email: form.email.trim(),
        sendAs: form.sendAs.trim() || undefined,
        imapHost: form.imapHost.trim(),
        imapPort: Number(form.imapPort),
        imapUser: form.imapUser.trim() || form.email.trim(),
        imapPass: form.imapPass,
        smtpHost: form.smtpHost.trim() || form.imapHost.trim(),
        smtpPort: Number(form.smtpPort),
        smtpUser: sameCreds ? form.imapUser.trim() || form.email.trim() : form.smtpUser.trim(),
        smtpPass: sameCreds ? form.imapPass : form.smtpPass,
      }
      await api.addImapAccount(input)
      setFormOpen(false)
      setForm({ ...emptyImapForm })
      setNotice({ kind: 'ok', text: 'Account added — first emails arrive in a minute.' })
      void api.sync(true).catch(() => {})
      void load()
    } catch (e) {
      setNotice({ kind: 'err', text: messageOf(e) })
    } finally {
      setBusy(false)
    }
  }

  async function saveSendAs(acc: MailAccount, value: string) {
    const v = value.trim()
    if (v === acc.sendAs) return
    try {
      await api.updateAccount(acc.id, { sendAs: v })
      setRowMsg((m) => ({ ...m, [acc.id]: 'Saved ✓' }))
      window.setTimeout(() => setRowMsg((m) => ({ ...m, [acc.id]: '' })), 1600)
      void load()
    } catch (e) {
      setRowMsg((m) => ({ ...m, [acc.id]: messageOf(e) }))
    }
  }

  async function rebuildStyle(acc: MailAccount) {
    if (styleBusyId) return
    setStyleBusyId(acc.id)
    setRowMsg((m) => ({ ...m, [acc.id]: 'Reading sent mail…' }))
    try {
      const r = await api.styleRefresh(acc.id)
      setRowMsg((m) => ({ ...m, [acc.id]: `Learned from ${r.sampleCount} emails ✓` }))
    } catch (e) {
      setRowMsg((m) => ({ ...m, [acc.id]: messageOf(e) }))
    } finally {
      setStyleBusyId(null)
    }
  }

  async function remove(acc: MailAccount) {
    if (!window.confirm(`Remove ${acc.email}? Its summaries disappear from this app.`)) return
    try {
      await api.deleteAccount(acc.id)
      void load()
    } catch (e) {
      setNotice({ kind: 'err', text: messageOf(e) })
    }
  }

  return (
    <Section title="Mail accounts" icon={sectionIcon.envelope}>
      {notice && (
        <div
          className={
            'rounded-xl p-3 text-sm mb-3 ' +
            (notice.kind === 'ok'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-red-50 border border-red-200 text-red-700')
          }
        >
          {notice.text}
        </div>
      )}

      {accounts === null ? (
        <div className="animate-pulse h-16 bg-line rounded-xl" />
      ) : accounts.length === 0 ? (
        <p className="text-sm text-muted">
          No mailbox connected yet — connect Gmail or add an IMAP account below. The Guide explains
          every step.
        </p>
      ) : (
        accounts.map((acc, i) => (
          <div key={acc.id}>
            {i > 0 && <div className="border-t border-line my-4" />}
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-lg bg-goldsoft flex items-center justify-center text-navydeep shrink-0">
                {acc.kind === 'gmail' ? (
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="7" rx="2" />
                    <rect x="3" y="13" width="18" height="7" rx="2" />
                    <path d="M7 7.5h.01M7 16.5h.01" />
                  </svg>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{acc.label}</div>
                <div className="text-xs text-muted truncate">{acc.email}</div>
              </div>
              <button
                type="button"
                onClick={() => void remove(acc)}
                className="w-9 h-9 flex items-center justify-center text-muted shrink-0"
                aria-label={`Remove ${acc.email}`}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <label className="block text-xs font-medium text-muted mb-1.5 mt-3">
              Send from this address
            </label>
            <input
              type="email"
              className={inputClass}
              defaultValue={acc.sendAs}
              placeholder={acc.email}
              onBlur={(e) => void saveSendAs(acc, e.target.value)}
            />
            <div className="flex items-center justify-between mt-2">
              <button
                type="button"
                className="text-sm text-navy underline py-2"
                onClick={() => void rebuildStyle(acc)}
                disabled={styleBusyId !== null}
              >
                Rebuild writing style
              </button>
              {rowMsg[acc.id] && <span className="text-xs text-muted">{rowMsg[acc.id]}</span>}
            </div>
            <p className="text-xs text-muted">
              Teach Zoryxa how you write — run after connecting, and every month or two.
            </p>
          </div>
        ))
      )}

      <p className="text-xs text-muted mt-3">
        Zoryxa never sends, deletes, or moves anything without your tap.
      </p>

      <div className="flex gap-3 mt-4">
        <button
          type="button"
          className="btn-ghost flex-1"
          onClick={() => {
            window.location.href = '/api/auth/google/start'
          }}
        >
          Connect Gmail
        </button>
        <button type="button" className="btn-ghost flex-1" onClick={() => setFormOpen((v) => !v)}>
          Add IMAP account
        </button>
      </div>

      {formOpen && (
        <div className="mt-4 rounded-xl border border-line bg-mist/60 p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Name</label>
            <input type="text" className={inputClass} placeholder="e.g. Office mailbox" value={form.label} onChange={(e) => setF({ label: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Email address</label>
            <input
              type="email"
              className={inputClass}
              value={form.email}
              onChange={(e) => setF({ email: e.target.value })}
              onBlur={() => {
                const d = detectServers(form.email)
                if (d === 'gmail') {
                  setDetectNote('For Gmail, use the "Connect Gmail" button instead — faster and safer.')
                } else if (d && !form.imapHost.trim()) {
                  setF({ ...d, imapUser: form.imapUser.trim() || form.email.trim() })
                  setDetectNote('Server details filled in automatically — adjust if IT gave you different ones.')
                }
              }}
            />
            {detectNote && <p className="text-xs text-golddeep mt-1.5">{detectNote}</p>}
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted pt-1">Receiving (ask IT if unsure)</p>
          <div className="flex gap-2">
            <input type="text" className={`${inputClass} flex-1`} placeholder="mail.yourdomain.com" value={form.imapHost} onChange={(e) => setF({ imapHost: e.target.value })} aria-label="IMAP server" />
            <input type="number" className={`${inputClass} w-24`} value={form.imapPort} onChange={(e) => setF({ imapPort: e.target.value })} aria-label="IMAP port" />
          </div>
          <input type="text" className={inputClass} placeholder="Username (usually the full email address)" value={form.imapUser} onChange={(e) => setF({ imapUser: e.target.value })} aria-label="IMAP username" />
          <input type="password" className={inputClass} placeholder="Password" value={form.imapPass} onChange={(e) => setF({ imapPass: e.target.value })} aria-label="IMAP password" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted pt-1">Sending</p>
          <div className="flex gap-2">
            <input type="text" className={`${inputClass} flex-1`} placeholder="Same server, or smtp.…" value={form.smtpHost} onChange={(e) => setF({ smtpHost: e.target.value })} aria-label="SMTP server" />
            <input type="number" className={`${inputClass} w-24`} value={form.smtpPort} onChange={(e) => setF({ smtpPort: e.target.value })} aria-label="SMTP port" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sameCreds} onChange={(e) => setSameCreds(e.target.checked)} className="w-4 h-4 accent-[#122B44]" />
            Same username and password as incoming
          </label>
          {!sameCreds && (
            <>
              <input type="text" className={inputClass} placeholder="Outgoing username" value={form.smtpUser} onChange={(e) => setF({ smtpUser: e.target.value })} aria-label="SMTP username" />
              <input type="password" className={inputClass} placeholder="Outgoing password" value={form.smtpPass} onChange={(e) => setF({ smtpPass: e.target.value })} aria-label="SMTP password" />
            </>
          )}
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Send as (optional alias)</label>
            <input type="email" className={inputClass} placeholder="Leave blank to send as the email above" value={form.sendAs} onChange={(e) => setF({ sendAs: e.target.value })} />
          </div>
          <button type="button" className="btn-primary w-full" onClick={() => void addImap()} disabled={busy}>
            {busy ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1" aria-hidden="true">
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" style={{ animationDelay: '300ms' }} />
                </span>
                Checking the mail server…
              </span>
            ) : (
              'Verify & add'
            )}
          </button>
        </div>
      )}
    </Section>
  )
}

export default function SettingsView(props: { auth: AuthStatus }) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [snapshot, setSnapshot] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gmailBanner, setGmailBanner] = useState<'connected' | 'error' | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .settings()
      .then((s) => {
        if (cancelled) return
        setSettings(s)
        setSnapshot(JSON.stringify(s))
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof ApiError ? e.message : 'Could not load settings — please try again.')
      })
    const v = new URLSearchParams(window.location.search).get('gmail')
    if (v === 'connected' || v === 'error') setGmailBanner(v)
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!saved) return
    const t = window.setTimeout(() => setSaved(false), 1600)
    return () => window.clearTimeout(t)
  }, [saved])

  const dirty = settings !== null && snapshot !== null && JSON.stringify(settings) !== snapshot

  function patch(p: Partial<AppSettings>) {
    setSettings((s) => (s ? { ...s, ...p } : s))
  }

  function patchCategory(index: number, p: Partial<Category>) {
    setSettings((s) =>
      s
        ? { ...s, categories: s.categories.map((c, i) => (i === index ? { ...c, ...p } : c)) }
        : s,
    )
  }

  function removeCategory(index: number) {
    setSettings((s) =>
      s ? { ...s, categories: s.categories.filter((_, i) => i !== index) } : s,
    )
  }

  function addCategory() {
    setSettings((s) => {
      if (!s) return s
      const base = slug('New category') || 'category'
      let key = base
      let n = 2
      while (s.categories.some((c) => c.key === key)) {
        key = `${base}-${n}`
        n += 1
      }
      return {
        ...s,
        categories: [
          ...s.categories,
          { key, label: 'New category', color: '#64748B', description: '' },
        ],
      }
    })
  }

  async function save() {
    if (!settings || saving) return
    if (
      !Number.isInteger(settings.digestHour) ||
      settings.digestHour < 0 ||
      settings.digestHour > 23
    ) {
      setError('Pick a digest time between midnight and 11 PM.')
      return
    }
    if (!settings.timezone.trim()) {
      setError('Please enter a timezone, like Asia/Dubai.')
      return
    }
    if (settings.categories.length < 1) {
      setError('Keep at least one category.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const savedSettings = await api.saveSettings(settings)
      setSettings(savedSettings)
      setSnapshot(JSON.stringify(savedSettings))
      setSaved(true)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <TopBar title="Settings" />
      <div className="max-w-screen-sm mx-auto px-4 pb-28">
        {gmailBanner === 'connected' && (
          <button
            type="button"
            onClick={() => setGmailBanner(null)}
            className="w-full text-left rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm p-3.5 mt-4"
          >
            Gmail connected successfully.
          </button>
        )}
        {gmailBanner === 'error' && (
          <button
            type="button"
            onClick={() => setGmailBanner(null)}
            className="w-full text-left rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3.5 mt-4"
          >
            Gmail connection failed — please try again.
          </button>
        )}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3.5 mt-4">
            {error}
          </div>
        )}

        {props.auth.user && (
          <div className="card p-4 mt-4 flex items-center gap-3">
            {props.auth.user.picture ? (
              <img
                src={props.auth.user.picture}
                alt=""
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-full shrink-0"
              />
            ) : (
              <span className="w-11 h-11 rounded-full bg-navy text-white flex items-center justify-center font-semibold shrink-0">
                {(props.auth.user.name || props.auth.user.email).slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate">
                {props.auth.user.name || props.auth.user.email}
              </div>
              <div className="text-xs text-muted truncate">{props.auth.user.email}</div>
            </div>
            <button
              type="button"
              className="text-sm text-muted underline py-2 shrink-0"
              onClick={() => {
                void api.logout().finally(() => window.location.assign('/login'))
              }}
            >
              Sign out
            </button>
          </div>
        )}

        <Link to="/guide" className="card p-4 mt-4 flex items-center gap-3 active:scale-[0.99] transition">
          <span className="w-10 h-10 rounded-xl bg-goldsoft flex items-center justify-center text-navydeep shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2H12v17H4.5A2.5 2.5 0 0 0 2 21.5v-17Z" />
              <path d="M22 4.5A2.5 2.5 0 0 0 19.5 2H12v17h7.5a2.5 2.5 0 0 1 2.5 2.5v-17Z" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">How to connect your mail</span>
            <span className="block text-xs text-muted">
              Step-by-step guide for Gmail, office and personal mailboxes
            </span>
          </span>
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-muted shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </Link>

        <AccountsSection />

        {settings === null ? (
          <div className="animate-pulse mt-5 space-y-3">
            <div className="h-40 bg-line rounded-2xl" />
            <div className="h-32 bg-line rounded-2xl" />
            <div className="h-52 bg-line rounded-2xl" />
          </div>
        ) : (
          <>
            <Section title="Morning digest" icon={sectionIcon.sun}>
              <label className="block text-xs font-medium text-muted mb-1.5" htmlFor="digest-hour">
                Arrives at
              </label>
              <select
                id="digest-hour"
                className={inputClass}
                value={String(settings.digestHour)}
                onChange={(e) => patch({ digestHour: Number(e.target.value) })}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={String(h)}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>

              <label className="block text-xs font-medium text-muted mb-1.5 mt-3" htmlFor="timezone">
                Timezone
              </label>
              <input
                id="timezone"
                type="text"
                className={inputClass}
                placeholder="Asia/Dubai"
                value={settings.timezone}
                onChange={(e) => patch({ timezone: e.target.value })}
              />
              <p className="text-xs text-muted mt-1.5">
                Like Asia/Dubai — this sets when your digest arrives.
              </p>

              <label className="block text-xs font-medium text-muted mb-1.5 mt-3" htmlFor="digest-to">
                Send digest to
              </label>
              <input
                id="digest-to"
                type="email"
                className={inputClass}
                value={settings.digestTo}
                onChange={(e) => patch({ digestTo: e.target.value })}
              />

              <p className="text-xs text-muted mt-3">
                The digest is emailed to you and appears in the Digest tab.
              </p>
            </Section>

            <Section title="AI assistant" icon={sectionIcon.sparkle}>
              <label className="block text-xs font-medium text-muted mb-1.5" htmlFor="provider">
                Powered by
              </label>
              <select
                id="provider"
                className={inputClass}
                value={settings.llmProvider}
                onChange={(e) => patch({ llmProvider: e.target.value as AppSettings['llmProvider'] })}
              >
                <option value="gemini">Google Gemini (free)</option>
                <option value="groq">Groq (free)</option>
              </select>

              <p className="text-xs text-muted mt-3">
                Each account has its own writing style — rebuild it from the account's row above.
              </p>
            </Section>

            <Section title="Categories" icon={sectionIcon.tag}>
              {settings.categories.map((cat, i) => (
                <div key={cat.key}>
                  {i > 0 && <div className="border-t border-line my-3" />}
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={cat.color}
                      onChange={(e) => patchCategory(i, { color: e.target.value })}
                      className="w-9 h-9 rounded-lg border border-line p-0.5 bg-paper shrink-0"
                      aria-label={`Colour for ${cat.label}`}
                    />
                    <input
                      type="text"
                      className={`${inputClass} flex-1`}
                      value={cat.label}
                      onChange={(e) => patchCategory(i, { label: e.target.value })}
                      aria-label="Category name"
                    />
                    {settings.categories.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCategory(i)}
                        className="w-9 h-9 flex items-center justify-center text-muted shrink-0"
                        aria-label={`Remove ${cat.label}`}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          aria-hidden="true"
                        >
                          <path d="M6 6l12 12M18 6 6 18" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-line bg-mist px-3.5 py-2 text-xs mt-2 focus:outline-none focus:ring-2 focus:ring-gold"
                    placeholder="What belongs here? (guides the AI)"
                    value={cat.description}
                    onChange={(e) => patchCategory(i, { description: e.target.value })}
                    aria-label={`Description for ${cat.label}`}
                  />
                </div>
              ))}
              <button type="button" className="btn-ghost w-full mt-2" onClick={addCategory}>
                Add category
              </button>
            </Section>
          </>
        )}

        <p className="text-center text-xs text-muted mt-8 font-display tracking-[0.18em]">
          ZORYXA MAIL
        </p>
      </div>

      {settings !== null && (dirty || saving || saved) && (
        <div className="fixed bottom-20 inset-x-0 z-20 px-4">
          <div className="max-w-screen-sm mx-auto">
            <button
              type="button"
              className="btn-primary w-full shadow-card"
              onClick={save}
              disabled={saving}
            >
              {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
