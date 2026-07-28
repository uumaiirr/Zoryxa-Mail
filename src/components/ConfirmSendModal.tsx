function Row(props: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-4 py-2.5">
      <div className="w-16 shrink-0 text-xs text-muted uppercase tracking-wide font-semibold">
        {props.label}
      </div>
      <div className="flex-1 min-w-0 font-medium break-words text-[15px]">{props.value}</div>
    </div>
  )
}

export default function ConfirmSendModal(props: {
  open: boolean
  to: string
  cc?: string
  subject: string
  body: string
  sending: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!props.open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-navydeep/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-6"
      onClick={() => {
        if (!props.sending) props.onCancel()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Review before sending"
    >
      <div
        className="bg-paper w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 safe-bottom max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />

        <div className="flex items-center gap-3">
          <span
            className="w-10 h-10 rounded-xl bg-goldsoft text-navydeep flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22l-4-9-9-4 20-7z" />
            </svg>
          </span>
          <h2 className="font-display font-bold text-lg">Review before sending</h2>
        </div>

        <div className="mt-3 divide-y divide-line border-y border-line">
          <Row label="To" value={props.to} />
          {props.cc ? <Row label="Cc" value={props.cc} /> : null}
          <Row label="Subject" value={props.subject} />
        </div>

        <div className="mt-3 bg-mist rounded-xl p-3.5 text-sm leading-relaxed whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
          {props.body}
        </div>

        <div className="flex gap-3 mt-4">
          <button type="button" className="btn-ghost flex-1" onClick={props.onCancel} disabled={props.sending}>
            Cancel
          </button>
          <button type="button" className="btn-gold flex-1" onClick={props.onConfirm} disabled={props.sending}>
            {props.sending ? 'Sending…' : 'Send now'}
          </button>
        </div>
      </div>
    </div>
  )
}
