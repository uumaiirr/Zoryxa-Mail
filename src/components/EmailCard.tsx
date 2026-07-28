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

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const first = words[0]?.charAt(0) ?? ''
  const last = words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? '') : ''
  return (first + last).toUpperCase() || '?'
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
    <Link
      to={'/email/' + email.id}
      className="card p-4 block active:scale-[0.99] transition"
      // Inline style (not border-l-* utilities): .card is declared after the
      // utilities layer, so its border shorthand would override them.
      style={
        email.isRead
          ? undefined
          : { borderLeftWidth: '2px', borderLeftColor: 'rgb(var(--c-gold))' }
      }
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0" aria-hidden="true">
          <div
            className={
              'w-10 h-10 rounded-full flex items-center justify-center font-display text-[13px] font-bold' +
              (category === undefined ? ' bg-goldsoft text-navydeep' : '')
            }
            style={
              category !== undefined
                ? { backgroundColor: category.color + '26', color: category.color }
                : undefined
            }
          >
            {initialsOf(email.fromName)}
          </div>
          {!email.isRead && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-gold border-2 border-paper" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold truncate min-w-0 flex-1">
              {email.fromName}
            </span>
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
        </div>
      </div>
    </Link>
  )
}
