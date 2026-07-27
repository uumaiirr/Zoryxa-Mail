import { useState } from 'react'
import type { FormEvent } from 'react'
import { api, ApiError } from '../lib/api'

export default function LoginView() {
  const [passcode, setPasscode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading || !passcode) return
    setLoading(true)
    setError(null)
    try {
      await api.login(passcode)
      window.location.assign('/')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('That passcode is not right — try again.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Something went wrong — please try again.')
      }
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy text-white flex flex-col items-center justify-center px-6 safe-top safe-bottom">
      <svg
        viewBox="0 0 48 48"
        className="w-16 h-16 text-gold"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="4" y="4" width="40" height="40" rx="11" />
        <rect x="13" y="17" width="22" height="15" rx="2.5" />
        <path d="m14 18.5 10 7.5 10-7.5" />
      </svg>

      <h1 className="font-display text-4xl font-bold tracking-tight mt-5">CEO Mail</h1>
      <p className="text-white/60 text-sm mt-1">Your inbox, already read.</p>

      <form onSubmit={onSubmit} className="w-full flex flex-col items-center">
        <input
          type="password"
          autoFocus
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Passcode"
          className="mt-8 w-full max-w-xs rounded-xl bg-white/10 border border-white/15 px-4 py-3.5 text-center tracking-[0.3em] text-lg placeholder:tracking-normal placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-gold"
        />
        {error && <p className="text-red-300 text-sm mt-3">{error}</p>}
        <button type="submit" className="btn-gold w-full max-w-xs mt-4" disabled={loading || !passcode}>
          {loading ? 'Opening…' : 'Open my inbox'}
        </button>
      </form>

      <p className="text-white/30 text-xs mt-10">Private — for Walid only</p>
    </div>
  )
}
