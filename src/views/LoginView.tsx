import { useState } from 'react'
import type { FormEvent } from 'react'
import { api, ApiError } from '../lib/api'
import ZoryxaLogo from '../components/ZoryxaLogo'

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
    // Brand hero: the Z mark in metallic silver on Deep Matte Black (locked).
    <div className="min-h-screen bg-[#0B0B0D] text-[#D9DCE3] flex flex-col items-center justify-center px-6 safe-top safe-bottom">
      <ZoryxaLogo size={84} variant="silver" />

      <h1 className="font-display text-[34px] font-extrabold tracking-[0.04em] text-white mt-6">
        ZORYXA
      </h1>
      <p className="font-display text-sm font-medium tracking-[0.52em] text-[#D9DCE3]/80 mt-0.5 ml-[0.52em]">
        MAIL
      </p>
      <p className="text-[#D9DCE3]/50 text-sm mt-4">Your inbox, already read.</p>

      <form onSubmit={onSubmit} className="w-full flex flex-col items-center">
        <input
          type="password"
          autoFocus
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Passcode"
          className="mt-8 w-full max-w-xs rounded-xl bg-white/[0.07] border border-white/10 px-4 py-3.5 text-center tracking-[0.3em] text-lg text-white placeholder:tracking-normal placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-[#3B82F6] transition"
        />
        {error && <p className="text-red-300 text-sm mt-3">{error}</p>}
        <button
          type="submit"
          className="w-full max-w-xs mt-4 rounded-xl bg-[#3B82F6] text-[#0B0B0D] font-semibold px-4 py-3 transition duration-200 active:scale-[0.98] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          disabled={loading || !passcode}
        >
          {loading ? 'Opening…' : 'Open my inbox'}
        </button>
      </form>

      <p className="text-white/25 text-xs mt-10 font-display tracking-[0.18em]">ZORYXA MAIL</p>
    </div>
  )
}
