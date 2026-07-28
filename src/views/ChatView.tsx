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
  const [attachment, setAttachment] = useState<{
    name: string
    mimeType: string
    dataBase64?: string
    storagePath?: string
  } | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const cancelledRef = useRef(false)

  function onPickFile(file: File | undefined) {
    setError(null)
    if (!file) return
    if (!/^image\//.test(file.type) && file.type !== 'application/pdf') {
      setError('Only images and PDF files can be attached.')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('Attachments must be under 50 MB.')
      return
    }
    // Small files travel inline; big ones go straight to private storage.
    if (file.size <= 3_500_000) {
      const reader = new FileReader()
      reader.onload = () => {
        const result = String(reader.result ?? '')
        const base64 = result.slice(result.indexOf(',') + 1)
        if (base64) setAttachment({ name: file.name, mimeType: file.type, dataBase64: base64 })
      }
      reader.readAsDataURL(file)
      return
    }
    setUploading(true)
    void (async () => {
      try {
        const u = await api.uploadUrl({ name: file.name, mimeType: file.type, size: file.size })
        const put = await fetch(u.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type, 'x-upsert': 'true' },
          body: file,
        })
        if (!put.ok) throw new Error(`upload failed (${put.status})`)
        if (cancelledRef.current) return
        setAttachment({ name: file.name, mimeType: file.type, storagePath: u.path })
      } catch (e) {
        if (!cancelledRef.current) {
          setError(
            e instanceof ApiError ? e.message : 'The upload failed — check your connection and try again.',
          )
        }
      } finally {
        if (!cancelledRef.current) setUploading(false)
      }
    })()
  }

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
    let content = text.trim()
    if ((!content && !attachment) || busy) return
    if (!content) content = 'Analyze the attached file.'
    const att = attachment ?? undefined
    if (att) content = `${content}\n(attached: ${att.name})`
    setError(null)
    setInput('')
    const next: ChatMessage[] = [...messages, { role: 'user', content }]
    setMessages(next)
    setBusy(true)
    try {
      const r = await api.chat(next, emailId, att)
      if (cancelledRef.current) return
      setAttachment(null)
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
          {uploading && (
            <div className="mb-2 inline-flex items-center gap-2 card px-3 py-2 text-sm">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-line border-t-gold animate-spin" />
              Uploading…
            </div>
          )}
          {attachment && (
            <div className="mb-2 inline-flex items-center gap-2 card px-3 py-2 text-sm max-w-full">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-golddeep shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              <span className="truncate">{attachment.name}</span>
              <button
                type="button"
                aria-label="Remove attachment"
                onClick={() => setAttachment(null)}
                className="w-6 h-6 flex items-center justify-center text-muted shrink-0"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          )}
          <form
            className="card flex items-end gap-2 p-2 shadow-lift"
            onSubmit={(e) => {
              e.preventDefault()
              void send(input)
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                onPickFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <button
              type="button"
              aria-label="Attach an image or PDF"
              onClick={() => fileRef.current?.click()}
              disabled={busy || uploading}
              className="w-10 h-10 rounded-xl text-muted flex items-center justify-center shrink-0 transition active:scale-95 active:bg-mist disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
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
              disabled={busy || uploading || (!input.trim() && !attachment)}
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
