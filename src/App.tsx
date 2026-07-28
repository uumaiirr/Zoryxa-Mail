import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { AuthStatus } from '../shared/types'
import { api } from './lib/api'
import BottomNav from './components/BottomNav'
import ZoryxaLogo from './components/ZoryxaLogo'
import ChatView from './views/ChatView'
import ComposeView from './views/ComposeView'
import DigestView from './views/DigestView'
import EmailDetailView from './views/EmailDetailView'
import GuideView from './views/GuideView'
import InboxView from './views/InboxView'
import LoginView from './views/LoginView'
import SettingsView from './views/SettingsView'

function Splash() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B0B0D] text-white relative overflow-hidden">
      <div
        className="absolute w-[420px] h-[420px] rounded-full opacity-[0.14] blur-3xl"
        style={{ background: 'radial-gradient(circle, #3B82F6 0%, transparent 65%)' }}
        aria-hidden="true"
      />
      <div className="relative intro-logo">
        <ZoryxaLogo size={76} variant="silver" />
      </div>
      <div className="relative font-display text-[26px] font-bold mt-5 intro-word">ZORYXA</div>
      <div className="relative text-sm text-white/45 mt-2 intro-sub">Preparing your inbox…</div>
    </div>
  )
}

export default function App() {
  const location = useLocation()
  const [auth, setAuth] = useState<AuthStatus | 'loading' | null>('loading')
  const [introHold, setIntroHold] = useState(true)

  useEffect(() => {
    api
      .authStatus()
      .then(setAuth)
      .catch(() => setAuth(null))
    // The branded intro plays fully even on instant loads.
    const t = window.setTimeout(() => setIntroHold(false), 1200)
    return () => window.clearTimeout(t)
  }, [])

  if (auth === 'loading' || introHold) return <Splash />

  if (location.pathname === '/login') {
    return (
      <Routes>
        <Route path="/login" element={<LoginView />} />
      </Routes>
    )
  }
  if (!auth || !auth.authed) return <Navigate to="/login" replace />

  const showNav = ['/', '/digest', '/settings', '/guide', '/chat'].includes(location.pathname)

  return (
    <div className="min-h-screen bg-mist">
      {/* keyed wrapper re-triggers the entrance animation on every route change */}
      <div key={location.pathname} className="page-in">
        <Routes>
          <Route path="/" element={<InboxView />} />
          <Route path="/email/:id" element={<EmailDetailView />} />
          <Route path="/compose" element={<ComposeView />} />
          <Route path="/chat" element={<ChatView />} />
          <Route path="/digest" element={<DigestView />} />
          <Route path="/settings" element={<SettingsView auth={auth} />} />
          <Route path="/guide" element={<GuideView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {showNav && <BottomNav />}
    </div>
  )
}
