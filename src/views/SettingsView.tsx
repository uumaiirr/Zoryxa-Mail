import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppSettings, AuthStatus, Category } from '../../shared/types'
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2 mt-5">{title}</h2>
      <div className="card p-4">{children}</div>
    </section>
  )
}

export default function SettingsView(props: { auth: AuthStatus }) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [snapshot, setSnapshot] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gmailBanner, setGmailBanner] = useState<'connected' | 'error' | null>(null)
  const [styleBusy, setStyleBusy] = useState(false)
  const [styleDone, setStyleDone] = useState<string | null>(null)
  const [styleError, setStyleError] = useState<string | null>(null)

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

  async function refreshStyle() {
    if (styleBusy) return
    setStyleBusy(true)
    setStyleDone(null)
    setStyleError(null)
    try {
      const r = await api.styleRefresh()
      setStyleDone(`Learned from ${r.sampleCount} sent emails.`)
    } catch (e) {
      setStyleError(e instanceof ApiError ? e.message : 'Could not read your sent mail — please try again.')
    } finally {
      setStyleBusy(false)
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

        <Section title="Gmail connection">
          {props.auth.gmailConnected ? (
            <>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="font-semibold">Connected</span>
              </div>
              {props.auth.grantedEmail && (
                <div className="text-sm text-muted mt-1">{props.auth.grantedEmail}</div>
              )}
              <p className="text-xs text-muted mt-2">
                Reading through the bridge account — your office mailbox is never modified.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-sm font-semibold text-amber-600">Not connected yet</span>
              </div>
              <button
                type="button"
                className="btn-primary w-full mt-3"
                onClick={() => {
                  window.location.href = '/api/auth/google/start'
                }}
              >
                Connect Gmail
              </button>
            </>
          )}
        </Section>

        {settings === null ? (
          <div className="animate-pulse mt-5 space-y-3">
            <div className="h-40 bg-line rounded-2xl" />
            <div className="h-32 bg-line rounded-2xl" />
            <div className="h-52 bg-line rounded-2xl" />
          </div>
        ) : (
          <>
            <Section title="Morning digest">
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

              <label className="block text-xs font-medium text-muted mb-1.5 mt-3" htmlFor="send-as">
                Send replies as
              </label>
              <input
                id="send-as"
                type="email"
                className={inputClass}
                value={settings.sendAs}
                onChange={(e) => patch({ sendAs: e.target.value })}
              />

              <p className="text-xs text-muted mt-3">
                The digest is emailed to you and appears in the Digest tab.
              </p>
            </Section>

            <Section title="AI assistant">
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

              <div className="border-t border-line my-4" />

              <button
                type="button"
                className="btn-ghost w-full"
                onClick={refreshStyle}
                disabled={styleBusy}
              >
                {styleBusy ? 'Reading your sent mail…' : 'Rebuild writing style'}
              </button>
              {styleDone && <p className="text-emerald-600 text-sm mt-2">{styleDone}</p>}
              {styleError && <p className="text-red-600 text-sm mt-2">{styleError}</p>}
              <p className="text-xs text-muted mt-3">
                The assistant studies how you write so drafts sound like you.
              </p>
            </Section>

            <Section title="Categories">
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

        <p className="text-center text-xs text-muted mt-8">CEO Mail · private build</p>
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
