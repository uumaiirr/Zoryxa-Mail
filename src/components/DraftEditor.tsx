const inputClass =
  'w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-gold/60 focus:bg-paper transition disabled:opacity-60'

const labelClass = 'text-xs font-semibold text-muted uppercase tracking-wide'

interface DraftFields {
  to: string
  cc: string
  subject: string
  body: string
}

export default function DraftEditor(props: {
  to: string
  cc: string
  subject: string
  body: string
  onChange: (patch: Partial<DraftFields>) => void
  disabled?: boolean
}) {
  const { to, cc, subject, body, onChange, disabled } = props

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-1.5 text-[11px] font-display font-bold tracking-[0.2em] text-golddeep">
        <svg
          viewBox="0 0 24 24"
          className="w-3.5 h-3.5"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 2.5 13.9 9.6 21 11.5l-7.1 1.9L12 20.5l-1.9-7.1L3 11.5l7.1-1.9L12 2.5Z" />
          <path d="M19 2.5l.7 2.3 2.3.7-2.3.7L19 8.5l-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" />
        </svg>
        DRAFTED IN YOUR VOICE
      </div>
      <label className="block space-y-1.5">
        <span className={labelClass}>To</span>
        <input
          type="text"
          inputMode="email"
          autoComplete="off"
          className={inputClass}
          value={to}
          onChange={(e) => onChange({ to: e.target.value })}
          disabled={disabled}
        />
      </label>

      <label className="block space-y-1.5">
        <span className={labelClass}>Cc</span>
        <input
          type="text"
          inputMode="email"
          autoComplete="off"
          placeholder="Optional"
          className={inputClass}
          value={cc}
          onChange={(e) => onChange({ cc: e.target.value })}
          disabled={disabled}
        />
      </label>

      <label className="block space-y-1.5">
        <span className={labelClass}>Subject</span>
        <input
          type="text"
          autoComplete="off"
          className={inputClass}
          value={subject}
          onChange={(e) => onChange({ subject: e.target.value })}
          disabled={disabled}
        />
      </label>

      <label className="block space-y-1.5">
        <span className={labelClass}>Message</span>
        <textarea
          className={`${inputClass} min-h-[180px] leading-relaxed`}
          value={body}
          onChange={(e) => onChange({ body: e.target.value })}
          disabled={disabled}
        />
      </label>
    </div>
  )
}
