import { useEffect, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import type { ChatMessage } from '../../shared/types'
import TopBar from '../components/TopBar'
import ZoryxaLogo from '../components/ZoryxaLogo'
import { api, ApiError } from '../lib/api'

const GLOBAL_SUGGESTIONS = [
  'What needs my attention today?',
  'Any deadlines I should worry about this week?',
  'Which emails are worth replying to first?',
]
const EMAIL_SUGGESTIONS = [
  'What is the feasibility of this?',
  'What are the risks if I say yes?',
  'How should I reply to get better terms?',
]

export default function ChatView() {
  const [params] = useSearchParams()
  const location = useLocation()
  const emailId = params.get('email') ?? undefined
  const aboutSubject = (location.state as { subject?: string } | null)?.subject

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    return () => {
      cancelledRef.current = true
    }
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy])

  async function send(text: string) {
    const content = text.trim()
    if (!content || busy) return
    setError(null)
    setInput('')
    const next: ChatMessage[] = [...messages, { role: 'user', content }]
    setMessages(next)
    setBusy(true)
    try {
      const r = await api.chat(next, emailId)
      if (cancelledRef.current) return
      setMessages([...next, { role: 'assistant', content: r.reply }])
    } catch (e) {
      if (cancelledRef.current) return
      setError(e instanceof ApiError ? e.message : 'Zoryxa AI could not answer — try again.')
    } finally {
      if (!cancelledRef.current) setBusy(false)
    }
  }

  const suggestions = emailId ? EMAIL_SUGGESTIONS : GLOBAL_SUGGESTIONS

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        back={Boolean(emailId)}
        title="Zoryxa AI"
        subtitle={emailId ? undefined : 'Ask anything about your mail'}
      />

      <div className="max-w-screen-sm mx-auto w-full px-4 flex-1 pb-44">
        {emailId && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-goldsoft text-navydeep text-xs font-semibold px-3 py-1.5 max-w-full">
            <span className="shrink-0">About:</span>
            <span className="truncate">{aboutSubject ?? 'this email'}</span>
          </div>
        )}

        {messages.length === 0 && !busy ? (
          <div className="mt-14 flex flex-col items-center text-center anim-in">
            <div className="relative">
              <div
                className="absolute inset-0 scale-150 opacity-20 blur-2xl"
                style={{ background: 'radial-gradient(circle, #3B82F6 0%, transparent 70%)' }}
                aria-hidden="true"
              />
              <ZoryxaLogo size={64} variant="blue" className="relative" />
            </div>
            <h2 className="font-display text-xl font-bold mt-5">Ask Zoryxa AI</h2>
            <p className="text-sm text-muted mt-1.5 max-w-[260px] leading-relaxed">
              {emailId
                ? 'Judgment on this email — feasibility, risks, how to answer.'
                : 'It knows your inbox. Ask for priorities, judgment, or advice.'}
            </p>
            <div className="flex flex-col gap-2 mt-6 w-full max-w-xs">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="card px-4 py-3 text-sm text-left active:scale-[0.98] transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="bg-navy text-white rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] leading-relaxed max-w-[85%] whitespace-pre-wrap break-words">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-goldsoft flex items-center justify-center shrink-0 mt-0.5 text-navydeep">
                    <ZoryxaLogo size={16} variant="current" />
                  </span>
                  <div className="card rounded-2xl rounded-tl-md px-4 py-2.5 text-[15px] leading-relaxed max-w-[85%] whitespace-pre-wrap break-words">
                    {m.content}
                  </div>
                </div>
              ),
            )}
            {busy && (
              <div className="flex items-start gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-goldsoft flex items-center justify-center shrink-0 mt-0.5 text-navydeep">
                  <ZoryxaLogo size={16} variant="current" />
                </span>
                <div className="card rounded-2xl rounded-tl-md px-4 py-3.5 inline-flex gap-1.5">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse"
                      style={{ animationDelay: `${d * 160}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3">
                {error}
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Input bar, floating above the nav */}
      <div className="fixed bottom-20 inset-x-0 z-20 px-4">
        <div className="max-w-screen-sm mx-auto">
          <form
            className="card flex items-end gap-2 p-2 shadow-lift"
            onSubmit={(e) => {
              e.preventDefault()
              void send(input)
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send(input)
                }
              }}
              rows={1}
              placeholder={emailId ? 'Ask about this email…' : 'Ask Zoryxa AI…'}
              className="flex-1 resize-none bg-transparent px-2.5 py-2 text-[15px] leading-relaxed focus:outline-none max-h-28"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="w-10 h-10 rounded-xl bg-navy text-white flex items-center justify-center shrink-0 transition active:scale-95 disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h13M13 6l6 6-6 6" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
