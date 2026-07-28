import { NavLink } from 'react-router-dom'
import ZoryxaLogo from './ZoryxaLogo'

function itemClass(active: boolean): string {
  return (
    'py-2.5 flex flex-col items-center gap-1 text-[11px] font-medium transition ' +
    (active ? 'text-navy' : 'text-muted')
  )
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-paper border-t border-line shadow-nav safe-bottom">
      <div className="max-w-screen-sm mx-auto grid grid-cols-5">
        <NavLink to="/" end className={({ isActive }) => itemClass(isActive)}>
          <svg viewBox="0 0 24 24" className="w-6 h-6" {...stroke} aria-hidden="true">
            <path d="M3 13h4l2 3h6l2-3h4" />
            <path d="M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
          </svg>
          Inbox
        </NavLink>
        <NavLink to="/digest" className={({ isActive }) => itemClass(isActive)}>
          <svg viewBox="0 0 24 24" className="w-6 h-6" {...stroke} aria-hidden="true">
            <circle cx="12" cy="14" r="4" />
            <path d="M12 6v2M4 14h2M18 14h2M6.3 8.3l1.4 1.4M17.7 8.3l-1.4 1.4M4 20h16" />
          </svg>
          Digest
        </NavLink>
        <NavLink
          to="/chat"
          className={({ isActive }) =>
            'flex flex-col items-center gap-1 text-[11px] font-medium pt-0 pb-2.5 transition ' +
            (isActive ? 'text-navy' : 'text-muted')
          }
          aria-label="Zoryxa AI"
        >
          <span className="w-12 h-12 -mt-4 rounded-2xl bg-navy text-white flex items-center justify-center shadow-lift ring-4 ring-mist glow-pulse">
            <ZoryxaLogo size={24} variant="current" />
          </span>
          AI
        </NavLink>
        <NavLink to="/compose" className={({ isActive }) => itemClass(isActive)}>
          <svg viewBox="0 0 24 24" className="w-6 h-6" {...stroke} aria-hidden="true">
            <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          </svg>
          Compose
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => itemClass(isActive)}>
          <svg viewBox="0 0 24 24" className="w-6 h-6" {...stroke} aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
        </NavLink>
      </div>
    </nav>
  )
}
