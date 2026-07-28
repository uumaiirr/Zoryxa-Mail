import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { EmailDetail } from '../../shared/types'
import { api } from '../lib/api'
import TopBar from '../components/TopBar'
import DraftEditor from '../components/DraftEditor'
import ConfirmSendModal from '../components/ConfirmSendModal'

const inputClass =
  'w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-gold/60 focus:bg-paper transition disabled:opacity-60'

interface Draft {
  to: string
  cc: string
  subject: string
  body: string
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  const out = (first + last).toUpperCase()
  return out || '?'
}

function formatReceived(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const day = d.getDate()
  const month = d.toLocaleString('en-GB', { month: 'short' })
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${month}, ${hh}:${mm}`
}

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-gold shrink-0" aria-hidden="true">
      <path d="M12 2l2.1 6.1L20.5 10l-6.4 1.9L12 18l-2.1-6.1L3.5 10l6.4-1.9L12 2z" />
      <path d="M19 15l.9 2.4 2.5.9-2.5.9-.9 2.4-.9-2.4-2.5-.9 2.5-.9.9-2.4z" opacity="0.65" />
    </svg>
  )
}

function SquareCheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 shrink-0 text-gold"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5.5" />
    </svg>
  )
}

function GreenCheckIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" className="mx-auto text-green-600" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.12" />
      <path d="M7 12.5l3.2 3.2L17 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function DetailSkeleton() {
  return (
    <div className="mt-3 space-y-3">
      <div className="card p-4 animate-pulse">
        <div className="h-6 bg-line rounded w-3/4" />
        <div className="mt-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-line" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-line rounded w-1/3" />
            <div className="h-3 bg-line rounded w-1/2" />
          </div>
        </div>
      </div>
      <div className="card p-4 animate-pulse space-y-2.5">
        <div className="h-3 bg-line rounded w-24" />
        <div className="h-4 bg-line rounded w-full" />
        <div className="h-4 bg-line rounded w-5/6" />
      </div>
      <div className="card p-4 animate-pulse space-y-2.5">
        <div className="h-3 bg-line rounded w-24" />
        <div className="h-4 bg-line rounded w-full" />
        <div className="h-4 bg-line rounded w-full" />
        <div className="h-4 bg-line rounded w-2/3" />
      </div>
    </div>
  )
}

export default function EmailDetailView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [detail, setDetail] = useState<EmailDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [instruction, setInstruction] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [drafting, setDrafting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [bodyExpanded, setBodyExpanded] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [wasAutoDrafted, setWasAutoDrafted] = useState(false)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      setError('This email could not be found.')
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .email(id)
      .then((d) => {
        if (cancelled) return
        setDetail(d)
        // Reply-worthy mail arrives with a reply already written in the CEO's
        // voice — surface it immediately, ready to review and send.
        if (d.draft) {
          const stored = d.draft
          setDraft((existing) => {
            if (existing) return existing
            setWasAutoDrafted(true)
            return { to: d.fromEmail, cc: '', subject: stored.subject, body: stored.body }
          })
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not open this email.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, reloadKey])

  // After a successful send, pause on the confirmation then head home.
  useEffect(() => {
    if (!sent) return
    const t = window.setTimeout(() => navigate('/'), 1500)
    return () => window.clearTimeout(t)
  }, [sent, navigate])

  const runDraft = useCallback(async () => {
    if (!id) return
    setDrafting(true)
    setError(null)
    try {
      const r = await api.draftReply(id, instruction.trim() || undefined)
      setDraft({
        to: r.to ?? detail?.fromEmail ?? '',
        cc: '',
        subject: r.subject,
        body: r.body,
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not write the draft. Please try again.')
    } finally {
      setDrafting(false)
    }
  }, [id, instruction, detail])

  const doSend = useCallback(async () => {
    if (!id || !draft) return
    setSending(true)
    setError(null)
    try {
      await api.send({
        to: draft.to,
        cc: draft.cc || undefined,
        subject: draft.subject,
        body: draft.body,
        replyToId: id,
      })
      setConfirmOpen(false)
      setSent(true)
    } catch (e: unknown) {
      setConfirmOpen(false)
      setError(e instanceof Error ? e.message : 'Sending failed. Please try again.')
    } finally {
      setSending(false)
    }
  }, [id, draft])

  const bodyIsLong = detail ? detail.body.length > 600 || detail.body.split('\n').length > 10 : false

  return (
    <>
      <TopBar back title="Email" />
      <div className="max-w-screen-sm mx-auto px-4 pb-28 anim-in">
        {error && detail && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        {loading && <DetailSkeleton />}

        {!loading && !detail && (
          <div className="card p-6 mt-3 text-center">
            <div className="font-semibold">Couldn't open this email</div>
            <p className="text-sm text-muted mt-1">{error ?? 'Something went wrong.'}</p>
            <button type="button" className="btn-primary w-full mt-4" onClick={() => setReloadKey((k) => k + 1)}>
              Try again
            </button>
          </div>
        )}

        {!loading && detail && (
          <>
            {/* Header */}
            <div className="card p-4 mt-3">
              <h1 className="font-display text-[22px] font-semibold leading-snug tracking-tight break-words">{detail.subject}</h1>
              <div className="mt-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-navy text-white flex items-center justify-center font-semibold shrink-0">
                  {initialsOf(detail.fromName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{detail.fromName}</div>
                  <div className="text-xs text-muted truncate">{detail.fromEmail}</div>
                </div>
                <div className="text-xs text-muted whitespace-nowrap">{formatReceived(detail.receivedAt)}</div>
              </div>
            </div>

            {/* AI summary */}
            <div className="card p-4 mt-3">
              <div className="flex items-center gap-1.5">
                <SparkleIcon />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Summary</span>
              </div>
              {detail.summarized && detail.tldr ? (
                <p className="mt-2 text-[15px] leading-relaxed">{detail.tldr}</p>
              ) : (
                <p className="mt-2 text-[15px] leading-relaxed italic text-muted">
                  Still summarizing — check back in a minute.
                </p>
              )}

              {detail.actionRequired && (
                <span className="mt-3 inline-flex items-center rounded-full bg-gold text-navydeep text-xs font-semibold px-3 py-1">
                  Action required
                </span>
              )}

              {detail.tasks.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">To do</div>
                  <ul className="mt-1.5 space-y-1.5">
                    {detail.tasks.map((task, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                        <SquareCheckIcon />
                        <span className="min-w-0">{task}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {detail.deadlines.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">Deadlines</div>
                  <div className="mt-1.5 space-y-1.5">
                    {detail.deadlines.map((dl, i) => (
                      <div key={i} className="flex items-center gap-2.5 text-sm">
                        <span className="rounded-full bg-goldsoft px-2.5 py-1 font-semibold text-xs text-navydeep whitespace-nowrap">
                          {dl.date}
                        </span>
                        <span className="min-w-0 leading-snug">{dl.what}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detail.participants.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {detail.participants.map((p) => (
                    <span key={p} className="rounded-full bg-mist text-muted text-xs px-2.5 py-1 max-w-full truncate">
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Full email */}
            <div className="card p-4 mt-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Full email</div>
              <div className={bodyIsLong && !bodyExpanded ? 'mt-2 max-h-48 overflow-hidden relative' : 'mt-2'}>
                <div className="whitespace-pre-wrap text-sm leading-relaxed break-words">{detail.body}</div>
                {bodyIsLong && !bodyExpanded && (
                  <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-paper to-transparent" aria-hidden="true" />
                )}
              </div>
              {bodyIsLong && (
                <button
                  type="button"
                  className="mt-1 w-full py-2.5 text-sm font-semibold text-navy"
                  onClick={() => setBodyExpanded((v) => !v)}
                >
                  {bodyExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>

            {/* Reply */}
            {sent ? (
              <div className="card p-6 mt-4 text-center">
                <GreenCheckIcon />
                <div className="mt-2 text-lg font-semibold">Reply sent</div>
                <p className="mt-1 text-sm text-muted">Taking you back to your inbox…</p>
              </div>
            ) : !draft ? (
              <div className="mt-4">
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Optional: tell me what to say…"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  disabled={drafting}
                />
                <button type="button" className="btn-primary w-full mt-2" onClick={() => void runDraft()} disabled={drafting}>
                  {drafting ? 'Writing in your voice…' : 'Draft a reply'}
                </button>
              </div>
            ) : (
              <div className="mt-4">
                {wasAutoDrafted && (
                  <div className="mb-2 flex items-center gap-2 rounded-xl bg-goldsoft px-3.5 py-2.5 text-sm text-navydeep">
                    <SparkleIcon />
                    <span>
                      <span className="font-semibold">Drafted for you</span> — written in your
                      voice. Edit anything, then send.
                    </span>
                  </div>
                )}
                <DraftEditor
                  to={draft.to}
                  cc={draft.cc}
                  subject={draft.subject}
                  body={draft.body}
                  onChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
                  disabled={sending || drafting}
                />
                <div className="flex gap-3 mt-3">
                  <button
                    type="button"
                    className="btn-ghost flex-1"
                    onClick={() => void runDraft()}
                    disabled={drafting || sending}
                  >
                    {drafting ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <SpinnerIcon />
                        Writing…
                      </span>
                    ) : (
                      'Regenerate'
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn-gold flex-1"
                    onClick={() => setConfirmOpen(true)}
                    disabled={drafting || sending || !draft.to.trim() || !draft.body.trim()}
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {draft && (
        <ConfirmSendModal
          open={confirmOpen}
          to={draft.to}
          cc={draft.cc || undefined}
          subject={draft.subject}
          body={draft.body}
          sending={sending}
          onConfirm={() => void doSend()}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </>
  )
}
