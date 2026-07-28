import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AppSettings, DigestRecord } from '../../shared/types'
import { api, ApiError } from '../lib/api'
import TopBar from '../components/TopBar'
import EmptyState from '../components/EmptyState'
import ZoryxaLogo from '../components/ZoryxaLogo'

function formatLongDate(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ymd
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatDeadlineDate(s: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00`)
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    }
  }
  return s
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

export default function DigestView() {
  const [digest, setDigest] = useState<DigestRecord | null | 'loading'>('loading')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [barsIn, setBarsIn] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.digestToday(), api.settings()])
      .then(([d, s]) => {
        if (cancelled) return
        setDigest(d.digest)
        setSettings(s)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setDigest(null)
        setError(e instanceof ApiError ? e.message : 'Could not load the digest — please try again.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Category bars paint once at 0 width, then expand — the CSS width
  // transition turns that first update into a gentle sweep-in.
  const hasDigest = digest !== 'loading' && digest !== null
  useEffect(() => {
    if (!hasDigest) return
    const t = window.setTimeout(() => setBarsIn(true), 60)
    return () => window.clearTimeout(t)
  }, [hasDigest])

  async function run() {
    if (running) return
    setRunning(true)
    setError(null)
    try {
      await api.digestRun()
      const r = await api.digestToday()
      setDigest(r.digest)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not build the digest — please try again.')
      // The digest may have been built even if emailing it failed — show it.
      try {
        const r = await api.digestToday()
        if (r.digest) setDigest(r.digest)
      } catch {
        /* keep the current state */
      }
    } finally {
      setRunning(false)
    }
  }

  const errorBanner = error ? (
    <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3.5 mt-4">
      {error}
    </div>
  ) : null

  if (digest === 'loading') {
    return (
      <>
        <TopBar title="Today's Digest" />
        <div className="max-w-screen-sm mx-auto px-4 pb-28 anim-in">
          <div className="animate-pulse mt-4 space-y-3">
            <div className="h-24 bg-line rounded-2xl" />
            <div className="h-24 bg-line rounded-2xl" />
            <div className="flex gap-3">
              <div className="h-24 flex-1 bg-line rounded-2xl" />
              <div className="h-24 flex-1 bg-line rounded-2xl" />
            </div>
            <div className="h-40 bg-line rounded-2xl" />
          </div>
        </div>
      </>
    )
  }

  if (digest === null) {
    return (
      <>
        <TopBar title="Today's Digest" />
        <div className="max-w-screen-sm mx-auto px-4 pb-28 anim-in">
          {errorBanner}
          <EmptyState
            title="No digest yet today"
            hint={`It lands in your inbox every morning at ${settings ? settings.digestHour : 7}:00.`}
            action={
              <button type="button" className="btn-primary" onClick={run} disabled={running}>
                {running ? 'Building…' : 'Build it now'}
              </button>
            }
          />
        </div>
      </>
    )
  }

  const c = digest.content
  const categoryRows = c.byCategory.filter((row) => row.count > 0)
  const maxCount = categoryRows.reduce((m, row) => Math.max(m, row.count), 1)
  const colorFor = (key: string): string =>
    settings?.categories.find((cat) => cat.key === key)?.color ?? '#94A3B8'

  return (
    <>
      <TopBar title="Today's Digest" />
      <div className="max-w-screen-sm mx-auto px-4 pb-28 anim-in">
        {errorBanner}

        <div className="card overflow-hidden relative p-5 mt-4">
          <div className="absolute -right-4 -bottom-6 opacity-[0.06] pointer-events-none" aria-hidden="true">
            <ZoryxaLogo size={120} variant="current" />
          </div>
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-display font-bold tracking-[0.24em] text-golddeep">
                MORNING BRIEFING
              </div>
              <div className="font-display text-xl font-semibold mt-1">
                {formatLongDate(digest.date)}
              </div>
            </div>
            {digest.emailedAt && (
              <span className="shrink-0 text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-full px-2.5 py-1 mt-0.5">
                Emailed ✓ {formatTime(digest.emailedAt)}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-2xl border-l-4 border-gold bg-goldsoft/40 p-4 mt-3">
          <div className="flex gap-2.5">
            <svg
              className="shrink-0 mt-1 text-golddeep"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
            </svg>
            <p className="text-[15px] leading-relaxed font-medium">{c.narrative}</p>
          </div>
        </div>

        <div className="flex gap-3 mt-3">
          <div className="card p-4 flex-1 relative">
            <svg
              className="absolute top-4 right-4 text-muted opacity-60"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <div className="font-display text-4xl font-semibold">{c.total}</div>
            <div className="text-xs text-muted mt-1">Emails (24h)</div>
          </div>
          <div className="card p-4 flex-1 relative">
            <svg
              className="absolute top-4 right-4 text-muted opacity-60"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className="font-display text-4xl font-semibold text-golddeep">{c.actionCount}</div>
            <div className="text-xs text-muted mt-1">Need action</div>
          </div>
        </div>

        {categoryRows.length > 0 && (
          <div className="card p-4 mt-3">
            {categoryRows.map((row) => (
              <div key={row.key} className="py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm flex-1 truncate">{row.label}</span>
                  <span className="text-sm font-semibold">{row.count}</span>
                </div>
                <div className="h-0.5 bg-line rounded mt-1.5">
                  <div
                    className="h-0.5 rounded"
                    style={{
                      width: barsIn ? `${Math.round((row.count / maxCount) * 100)}%` : '0%',
                      transition: 'width .6s cubic-bezier(.22,1,.36,1)',
                      backgroundColor: colorFor(row.key),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {c.topItems.length > 0 && (
          <section className="mt-4">
            <h2 className="text-xs uppercase font-semibold text-muted mb-2">Top priorities</h2>
            {c.topItems.map((item) => (
              <Link
                key={item.id}
                to={`/email/${item.id}`}
                className="card p-3.5 mb-2 block active:scale-[0.99] transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center font-semibold text-xs shrink-0">
                    {initialsOf(item.fromName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm flex-1 truncate">{item.fromName}</span>
                      {item.actionRequired && (
                        <span className="shrink-0 text-[11px] font-semibold text-gold bg-gold/15 rounded-full px-2 py-0.5">
                          Action
                        </span>
                      )}
                    </div>
                    <div className="text-sm truncate mt-0.5">{item.subject}</div>
                    <div className="text-xs text-muted line-clamp-1 mt-0.5">{item.tldr}</div>
                  </div>
                  <svg
                    className="shrink-0 text-muted opacity-60"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </Link>
            ))}
          </section>
        )}

        {c.deadlines.length > 0 && (
          <div className="card p-4 mt-3">
            <h2 className="text-xs uppercase font-semibold text-muted mb-3">Deadlines</h2>
            <div className="space-y-3">
              {c.deadlines.map((d, i) => (
                <div key={`${d.date}-${i}`} className="flex items-center gap-3">
                  <span className="bg-goldsoft text-navydeep text-xs font-semibold rounded-lg px-2 py-1 shrink-0 whitespace-nowrap">
                    {formatDeadlineDate(d.date)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">{d.what}</div>
                    <div className="text-xs text-muted truncate">{d.subject}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-center">
          <button type="button" className="btn-ghost text-sm" onClick={run} disabled={running}>
            {running ? 'Building…' : 'Rebuild digest'}
          </button>
        </div>
      </div>
    </>
  )
}
