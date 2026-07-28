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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B0B0D] text-white">
      <ZoryxaLogo size={64} variant="silver" />
      <div className="font-display text-2xl font-extrabold tracking-[0.04em] mt-4">ZORYXA</div>
      <div className="mt-2 text-sm text-white/50">Preparing your inbox…</div>
    </div>
  )
}

export default function App() {
  const location = useLocation()
  const [auth, setAuth] = useState<AuthStatus | 'loading' | null>('loading')

  useEffect(() => {
    api
      .authStatus()
      .then(setAuth)
      .catch(() => setAuth(null))
  }, [])

  if (location.pathname === '/login') {
    return (
      <Routes>
        <Route path="/login" element={<LoginView />} />
      </Routes>
    )
  }

  if (auth === 'loading') return <Splash />
  if (!auth || !auth.authed) return <Navigate to="/login" replace />

  const showNav = ['/', '/digest', '/settings', '/guide', '/chat'].includes(location.pathname)

  return (
    <div className="min-h-screen bg-mist">
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
      {showNav && <BottomNav />}
    </div>
  )
}
