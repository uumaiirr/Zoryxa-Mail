import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { EmailDetail } from '../../shared/types'
import { api } from '../lib/api'
import TopBar from '../components/TopBar'
import DraftEditor from '../components/DraftEditor'
import ConfirmSendModal from '../components/ConfirmSendModal'
import ZoryxaLogo from '../components/ZoryxaLogo'

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

/** Renders the email's original HTML the way Spark/Gmail do — inside a
 *  sandboxed frame (scripts blocked) that sizes itself to the content. */
function HtmlBody({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement | null>(null)
  const [height, setHeight] = useState(200)
  // No inner scrollbar: the frame grows to fit and the PAGE scrolls, exactly
  // like Gmail/Spark/Outlook. Height is re-measured as images finish loading.
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"><style>
html,body{margin:0;padding:0;overflow:hidden}
body{font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.55;color:#16181d;background:#fff;word-break:break-word;padding:2px 2px 6px}
img{max-width:100%!important;height:auto!important}
table{max-width:100%!important}
blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #e4e6ea;color:#5a616c}
a{color:#2563EB}
</style></head><body>${html}</body></html>`

  useEffect(() => {
    const measure = () => {
      try {
        const d = ref.current?.contentDocument
        if (!d?.body) return
        const h = Math.max(d.body.scrollHeight, d.documentElement.scrollHeight)
        if (h > 0) setHeight(Math.min(Math.max(h + 8, 120), 20000))
      } catch {
        /* keep current height */
      }
    }
    const t1 = window.setTimeout(measure, 120)
    const t2 = window.setTimeout(measure, 700)
    const t3 = window.setTimeout(measure, 2000)
    window.addEventListener('resize', measure)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
      window.removeEventListener('resize', measure)
    }
  }, [html])

  return (
    <iframe
      ref={ref}
      title="Email content"
      sandbox="allow-same-origin allow-popups"
      srcDoc={doc}
      scrolling="no"
      className="w-full block border-0 bg-white rounded-lg"
      style={{ height }}
      onLoad={() => {
        try {
          const d = ref.current?.contentDocument
          if (d?.body) {
            setHeight(Math.min(Math.max(d.body.scrollHeight + 8, 120), 20000))
            for (const img of Array.from(d.images)) {
              img.addEventListener('load', () => {
                const h = d.body.scrollHeight
                if (h > 0) setHeight(Math.min(Math.max(h + 8, 120), 20000))
              })
            }
          }
        } catch {
          /* keep default height */
        }
      }}
    />
  )
}

function formatBytes(n: number): string {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function fileIconFor(mime: string) {
  if (/^image\//.test(mime)) return 'image'
  if (mime === 'application/pdf') return 'pdf'
  if (/sheet|excel|csv/.test(mime)) return 'sheet'
  return 'file'
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
  const [analyzing, setAnalyzing] = useState(false)
  const [traceOpen, setTraceOpen] = useState(false)

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
        // Deep AI runs the moment the email is opened — the list itself is
        // never mass-summarized. Cached after the first time.
        if (!d.analyzed) {
          setAnalyzing(true)
          api
            .analyze(id)
            .then((a) => {
              if (cancelled) return
              setDetail((cur) =>
                cur && cur.id === d.id
                  ? {
                      ...cur,
                      analyzed: true,
                      tldr: a.tldr,
                      participants: a.participants,
                      deadlines: a.deadlines,
                      actionRequired: a.actionRequired,
                      tasks: a.tasks,
                    }
                  : cur,
              )
              if (a.draft) {
                const made = a.draft
                setDraft((existing) => {
                  if (existing) return existing
                  setWasAutoDrafted(true)
                  return { to: d.fromEmail, cc: '', subject: made.subject, body: made.body }
                })
              }
            })
            .catch(() => {})
            .finally(() => {
              if (!cancelled) setAnalyzing(false)
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
              {detail.tldr ? (
                <p className="mt-2 text-[15px] leading-relaxed">{detail.tldr}</p>
              ) : analyzing ? (
                <div className="mt-2.5 space-y-2 animate-pulse" aria-label="Reading this email">
                  <div className="h-3.5 bg-line rounded w-full" />
                  <div className="h-3.5 bg-line rounded w-4/5" />
                </div>
              ) : (
                <p className="mt-2 text-[15px] leading-relaxed italic text-muted">
                  Open again in a moment — the assistant is catching up.
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

            {/* Ask Zoryxa AI about this email */}
            <button
              type="button"
              onClick={() =>
                navigate(`/chat?email=${encodeURIComponent(id ?? '')}`, {
                  state: { subject: detail.subject },
                })
              }
              className="card w-full p-3.5 mt-3 flex items-center gap-3 text-left active:scale-[0.99] transition"
            >
              <span className="w-9 h-9 rounded-lg bg-navy text-white flex items-center justify-center shrink-0">
                <ZoryxaLogo size={18} variant="current" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold text-sm">Ask Zoryxa AI</span>
                <span className="block text-xs text-muted">
                  Feasibility, risks, how to answer — anything
                </span>
              </span>
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-muted shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>

            {/* Conversation trace — the earlier messages in this thread */}
            {detail.thread.length > 0 && (
              <div className="card mt-3 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setTraceOpen((v) => !v)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left min-h-[48px]"
                  aria-expanded={traceOpen}
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-muted shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="text-sm font-semibold flex-1">
                    {traceOpen ? 'Hide history' : `Show history (${detail.thread.length})`}
                  </span>
                  <svg viewBox="0 0 24 24" className={'w-4 h-4 text-muted transition ' + (traceOpen ? 'rotate-90' : '')} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>
                {traceOpen && (
                  <div className="border-t border-line divide-y divide-line">
                    {detail.thread.map((t) => (
                      <Link key={t.id} to={'/email/' + t.id} className="block px-4 py-3 active:bg-mist transition">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold truncate flex-1">
                            {t.folder === 'sent' ? 'You' : t.fromName}
                          </span>
                          <span className="text-xs text-muted shrink-0">
                            {new Date(t.receivedAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-muted line-clamp-2 mt-0.5">{t.snippet}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Attachments */}
            {detail.attachments.length > 0 && (
              <div className="card p-4 mt-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2.5">
                  {detail.attachments.length} attachment
                  {detail.attachments.length === 1 ? '' : 's'}
                </div>
                <div className="flex flex-wrap gap-2">
                  {detail.attachments.map((a) => {
                    const kind = fileIconFor(a.mimeType)
                    return (
                      <a
                        key={a.ref}
                        href={api.attachmentUrl(detail.id, a.ref)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2.5 rounded-xl border border-line bg-mist px-3 py-2.5 max-w-full active:scale-[0.98] transition"
                      >
                        <span className="w-8 h-8 rounded-lg bg-goldsoft text-navydeep flex items-center justify-center shrink-0">
                          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            {kind === 'image' ? (
                              <>
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <path d="m21 15-5-5L5 21" />
                              </>
                            ) : kind === 'sheet' ? (
                              <>
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
                              </>
                            ) : (
                              <>
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <path d="M14 2v6h6" />
                              </>
                            )}
                          </svg>
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium truncate max-w-[190px]">
                            {a.name}
                          </span>
                          <span className="block text-xs text-muted">{formatBytes(a.size)}</span>
                        </span>
                      </a>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Full email — original HTML when the message has it */}
            <div className="card p-4 mt-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Full email</div>
              {detail.bodyHtml ? (
                <div className="mt-2">
                  <HtmlBody html={detail.bodyHtml} />
                </div>
              ) : (
                <>
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
                </>
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
