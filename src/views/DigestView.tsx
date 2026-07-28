import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AppSettings, DigestRecord } from '../../shared/types'
import { api, ApiError } from '../lib/api'
import TopBar from '../components/TopBar'
import EmptyState from '../components/EmptyState'

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

export default function DigestView() {
  const [digest, setDigest] = useState<DigestRecord | null | 'loading'>('loading')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
            <div className="h-4 w-44 bg-line rounded" />
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

        <div className="flex items-center justify-between gap-3 mt-4">
          <div className="text-sm text-muted">{formatLongDate(digest.date)}</div>
          {digest.emailedAt && (
            <span className="shrink-0 text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-full px-2.5 py-1">
              Emailed ✓ {formatTime(digest.emailedAt)}
            </span>
          )}
        </div>

        <div className="rounded-r-2xl border-l-4 border-gold bg-goldsoft/40 p-4 text-[15px] leading-relaxed font-medium mt-3">
          {c.narrative}
        </div>

        <div className="flex gap-3 mt-3">
          <div className="card p-4 flex-1">
            <div className="font-display text-4xl font-semibold">{c.total}</div>
            <div className="text-xs text-muted mt-1">Emails (24h)</div>
          </div>
          <div className="card p-4 flex-1">
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
                      width: `${Math.round((row.count / maxCount) * 100)}%`,
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
              <Link key={item.id} to={`/email/${item.id}`} className="card p-3.5 mb-2 block">
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
