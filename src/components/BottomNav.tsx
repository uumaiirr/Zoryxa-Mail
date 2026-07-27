import { NavLink } from 'react-router-dom'

const itemClass = ({ isActive }: { isActive: boolean }) =>
  `py-2.5 flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
    isActive ? 'text-navy' : 'text-muted'
  }`

function InboxIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  )
}

function DigestIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 18a5 5 0 0 0-10 0" />
      <path d="M12 9V2" />
      <path d="m4.22 10.22 1.42 1.42" />
      <path d="M2 18h2" />
      <path d="M20 18h2" />
      <path d="m18.36 11.64 1.42-1.42" />
      <path d="M3 22h18" />
      <path d="m8 6 4-4 4 4" />
    </svg>
  )
}

function PenIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5 text-white"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-paper border-t border-line shadow-nav safe-bottom">
      <div className="max-w-screen-sm mx-auto grid grid-cols-4">
        <NavLink to="/" end className={itemClass}>
          <InboxIcon />
          <span>Inbox</span>
        </NavLink>
        <NavLink to="/digest" className={itemClass}>
          <DigestIcon />
          <span>Digest</span>
        </NavLink>
        <NavLink to="/compose" className={itemClass}>
          <span className="w-11 h-11 -mt-4 rounded-full bg-gold shadow-card flex items-center justify-center">
            <PenIcon />
          </span>
          <span>Compose</span>
        </NavLink>
        <NavLink to="/settings" className={itemClass}>
          <GearIcon />
          <span>Settings</span>
        </NavLink>
      </div>
    </nav>
  )
}
