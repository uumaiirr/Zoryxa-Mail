import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

export default function TopBar(props: {
  title: string
  subtitle?: string
  back?: boolean
  right?: ReactNode
}) {
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-20 bg-mist/90 backdrop-blur border-b border-line safe-top">
      <div className="max-w-screen-sm mx-auto px-4 py-3 flex items-center gap-3">
        {props.back && (
          <button
            type="button"
            aria-label="Go back"
            onClick={() => navigate(-1)}
            className="-ml-2 w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-ink active:bg-line/60 transition"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[22px] font-semibold tracking-tight truncate">{props.title}</h1>
          {props.subtitle && <p className="text-xs text-muted truncate">{props.subtitle}</p>}
        </div>
        {props.right && <div className="shrink-0 flex items-center">{props.right}</div>}
      </div>
    </header>
  )
}
