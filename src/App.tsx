import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { AuthStatus } from '../shared/types'
import { api } from './lib/api'
import BottomNav from './components/BottomNav'
import ComposeView from './views/ComposeView'
import DigestView from './views/DigestView'
import EmailDetailView from './views/EmailDetailView'
import InboxView from './views/InboxView'
import LoginView from './views/LoginView'
import SettingsView from './views/SettingsView'

function Splash() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-navy text-white">
      <div className="font-display text-3xl font-bold tracking-tight">CEO Mail</div>
      <div className="mt-2 text-sm text-white/60">Preparing your inbox…</div>
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

  const showNav = ['/', '/digest', '/settings'].includes(location.pathname)

  return (
    <div className="min-h-screen bg-mist">
      <Routes>
        <Route path="/" element={<InboxView />} />
        <Route path="/email/:id" element={<EmailDetailView />} />
        <Route path="/compose" element={<ComposeView />} />
        <Route path="/digest" element={<DigestView />} />
        <Route path="/settings" element={<SettingsView auth={auth} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showNav && <BottomNav />}
    </div>
  )
}
