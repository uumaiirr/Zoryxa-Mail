import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MailAccount } from '../../shared/types'
import { api, ApiError } from '../lib/api'
import TopBar from '../components/TopBar'
import DraftEditor from '../components/DraftEditor'
import ConfirmSendModal from '../components/ConfirmSendModal'
import ZoryxaLogo from '../components/ZoryxaLogo'

function DraftingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  )
}

interface Draft {
  to: string
  cc: string
  subject: string
  body: string
}

const EXAMPLES = [
  "Confirm Tuesday's call with the Afreximbank team",
  'Thank the JAFZA team for the meeting and share next steps',
  'Ask accounts to send the outstanding invoices list',
]

const EMAIL_RE = /\S+@\S+\.\S+/

export default function ComposeView() {
  const navigate = useNavigate()
  const [instruction, setInstruction] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [generating, setGenerating] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountsList, setAccountsList] = useState<MailAccount[]>([])
  const [fromAccountId, setFromAccountId] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    [],
  )

  useEffect(() => {
    let cancelled = false
    api
      .accounts()
      .then((accs) => {
        if (cancelled) return
        setAccountsList(accs)
        setFromAccountId((cur) => cur ?? accs[0]?.id ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  async function generate() {
    if (!instruction.trim() || generating) return
    setGenerating(true)
    setError(null)
    try {
      const r = await api.draftCompose(instruction.trim())
      // Keep a recipient the user already typed — regenerating the text must
      // never wipe their manual edits to the To field.
      setDraft((prev) => ({
        to: prev?.to?.trim() ? prev.to : (r.to ?? ''),
        cc: prev?.cc ?? r.cc ?? '',
        subject: r.subject,
        body: r.body,
      }))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong — please try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function send() {
    if (!draft || sending) return
    setSending(true)
    setError(null)
    try {
      await api.send({
        to: draft.to,
        cc: draft.cc || undefined,
        subject: draft.subject,
        body: draft.body,
        fromAccountId: fromAccountId ?? undefined,
      })
      setConfirmOpen(false)
      setSent(true)
      timerRef.current = window.setTimeout(() => navigate('/'), 1500)
    } catch (e) {
      setConfirmOpen(false)
      setError(e instanceof ApiError ? e.message : 'Sending failed — please try again.')
    } finally {
      setSending(false)
    }
  }

  const canSend =
    draft !== null &&
    fromAccountId !== null &&
    EMAIL_RE.test(draft.to) &&
    draft.subject.trim() !== '' &&
    draft.body.trim() !== ''

  return (
    <>
      <TopBar title="New email" back />
      <div className="max-w-screen-sm mx-auto px-4 pb-28">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3.5 mt-4">
            {error}
          </div>
        )}

        {sent ? (
          <div className="card p-6 mt-4 text-center anim-in">
            <span className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="w-6 h-6 text-emerald-600"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m4 12.5 5.5 5.5L20 6.5" />
              </svg>
            </span>
            <div className="font-bold text-lg mt-3">Sent</div>
            <p className="text-sm text-muted mt-1">Your email is on its way.</p>
          </div>
        ) : draft === null ? (
          <div className="card p-5 mt-4">
            <div className="w-11 h-11 rounded-xl bg-navy text-white flex items-center justify-center">
              <ZoryxaLogo size={22} variant="current" />
            </div>
            <h1 className="font-display text-[22px] font-semibold mt-3">What should I write?</h1>
            <p className="text-sm text-muted mt-1">
              Describe it in one line — I will draft it in your voice.
            </p>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. Email the Afreximbank team confirming Tuesday's call"
              className="mt-4 w-full min-h-[110px] rounded-xl border border-line bg-mist px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gold"
            />
            <div className="flex flex-wrap gap-2 mt-3">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setInstruction(ex)}
                  className="rounded-full bg-mist border border-line px-3 py-2 text-xs text-muted active:bg-goldsoft active:text-navydeep active:border-gold/30 active:scale-[0.97] transition"
                >
                  {ex}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn-primary w-full mt-4"
              onClick={generate}
              disabled={!instruction.trim() || generating}
            >
              {generating ? (
                <span className="inline-flex items-center gap-2">
                  Drafting
                  <DraftingDots />
                </span>
              ) : (
                'Generate draft'
              )}
            </button>
          </div>
        ) : (
          <div className="mt-4">
            {accountsList.length === 0 && (
              <div className="rounded-xl bg-goldsoft p-3.5 text-sm text-navydeep mb-3">
                Connect a mail account in Settings before sending.
              </div>
            )}
            {accountsList.length > 1 && (
              <div className="card p-4 mb-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted">
                  From
                </label>
                <select
                  value={fromAccountId ?? ''}
                  onChange={(e) => setFromAccountId(e.target.value || null)}
                  className="mt-1.5 w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-gold/60 focus:bg-paper transition"
                >
                  {accountsList.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label} — {a.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <DraftEditor
              to={draft.to}
              cc={draft.cc}
              subject={draft.subject}
              body={draft.body}
              onChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
              disabled={generating || sending}
            />
            <div className="flex gap-3 mt-3">
              <button
                type="button"
                className="btn-ghost flex-1"
                onClick={generate}
                disabled={generating}
              >
                {generating ? 'Drafting…' : 'Regenerate'}
              </button>
              <button
                type="button"
                className="btn-gold flex-1"
                onClick={() => setConfirmOpen(true)}
                disabled={!canSend || sending}
              >
                Send
              </button>
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                className="text-sm text-muted underline mt-3 px-3 py-2"
                onClick={() => setDraft(null)}
              >
                Start over
              </button>
            </div>
          </div>
        )}
      </div>

      {draft !== null && (
        <ConfirmSendModal
          open={confirmOpen}
          to={draft.to}
          cc={draft.cc || undefined}
          subject={draft.subject}
          body={draft.body}
          sending={sending}
          onConfirm={send}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </>
  )
}
