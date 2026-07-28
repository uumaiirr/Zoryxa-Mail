import { Link } from 'react-router-dom'
import type { Category, EmailSummary } from '../../shared/types'

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function EmailCard(props: {
  email: EmailSummary
  category?: Category
  accountLabel?: string
}) {
  const { email, category, accountLabel } = props
  const hasChips =
    category !== undefined ||
    email.actionRequired ||
    email.deadlines.length > 0 ||
    email.hasDraft ||
    accountLabel !== undefined

  return (
    <Link to={'/email/' + email.id} className="card p-4 block active:scale-[0.99] transition">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {!email.isRead && (
            <span className="w-2 h-2 rounded-full bg-navy shrink-0" aria-hidden="true" />
          )}
          <span className="text-[15px] font-semibold truncate">{email.fromName}</span>
        </div>
        <span className="text-xs text-muted shrink-0">{formatTime(email.receivedAt)}</span>
      </div>

      <p className={'text-sm truncate mt-0.5' + (email.isRead ? '' : ' font-medium')}>
        {email.subject}
      </p>

      {email.summarized && email.tldr ? (
        <p className="text-sm text-muted line-clamp-2 mt-1">{email.tldr}</p>
      ) : (
        <div className="mt-1">
          <p className="text-sm italic text-muted/70 line-clamp-2">{email.snippet}</p>
          <p className="text-xs text-muted/70 animate-pulse mt-0.5">Summarizing…</p>
        </div>
      )}

      {hasChips && (
        <div className="flex gap-1.5 flex-wrap mt-2">
          {accountLabel !== undefined && (
            <span className="rounded-full bg-mist border border-line text-muted text-xs font-medium px-2 py-1">
              {accountLabel}
            </span>
          )}
          {category !== undefined && (
            <span
              className="text-xs font-medium rounded-full px-2 py-1"
              style={{ backgroundColor: category.color + '1F', color: category.color }}
            >
              {category.label}
            </span>
          )}
          {email.actionRequired && (
            <span className="bg-goldsoft text-navydeep text-xs font-semibold rounded-full px-2 py-1">
              Action
            </span>
          )}
          {email.hasDraft && (
            <span className="inline-flex items-center gap-1 bg-navy text-white text-xs font-semibold rounded-full px-2 py-1">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
              Draft ready
            </span>
          )}
          {email.deadlines.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-muted border border-line rounded-full px-2 py-1">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {email.deadlines[0].date}
            </span>
          )}
        </div>
      )}
    </Link>
  )
}
