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
