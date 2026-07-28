import { useMemo } from 'react'
import ZoryxaLogo from '../components/ZoryxaLogo'
import { LOGIN_URL } from '../lib/api'

const ERROR_COPY: Record<string, string> = {
  denied: 'This email is not on the access list for this workspace.',
  cancelled: 'Sign-in was cancelled — try again whenever you like.',
  failed: 'Google sign-in failed — please try again.',
  retry: 'That sign-in link expired — please try again.',
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

export default function LoginView() {
  const error = useMemo(() => {
    const e = new URLSearchParams(window.location.search).get('e')
    return e ? (ERROR_COPY[e] ?? ERROR_COPY.failed) : null
  }, [])

  return (
    // Brand hero: the Z mark in metallic silver on Deep Matte Black (locked).
    <div className="min-h-screen bg-[#0B0B0D] text-[#D9DCE3] flex flex-col items-center justify-center px-6 safe-top safe-bottom relative overflow-hidden">
      {/* Ambient electric-blue glow */}
      <div
        className="absolute w-[480px] h-[480px] rounded-full opacity-[0.13] blur-3xl"
        style={{ background: 'radial-gradient(circle, #3B82F6 0%, transparent 65%)' }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col items-center anim-in">
        <ZoryxaLogo size={92} variant="silver" />

        <h1 className="font-display text-[36px] font-extrabold tracking-[0.04em] text-white mt-7">
          ZORYXA
        </h1>
        <p className="font-display text-sm font-medium tracking-[0.52em] text-[#D9DCE3]/80 mt-0.5 ml-[0.52em]">
          MAIL
        </p>
        <p className="text-[#D9DCE3]/50 text-[15px] mt-5 text-center max-w-[260px] leading-relaxed">
          Your inbox — read, sorted, and drafted before you arrive.
        </p>

        {error && (
          <p className="mt-6 text-sm text-red-300 bg-red-500/10 border border-red-400/20 rounded-xl px-4 py-2.5 max-w-xs text-center">
            {error}
          </p>
        )}

        <a
          href={LOGIN_URL}
          className="mt-8 w-full max-w-xs inline-flex items-center justify-center gap-3 rounded-xl bg-white text-[#0B0B0D] font-semibold px-4 py-3.5 transition duration-200 active:scale-[0.98] hover:bg-[#F2F4F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]"
        >
          <GoogleG />
          Continue with Google
        </a>
        <p className="text-white/30 text-xs mt-4 max-w-[280px] text-center leading-relaxed">
          Your own private space — your mailboxes, your digest, your AI. No passwords.
        </p>
      </div>

      <p className="absolute bottom-8 text-white/25 text-xs font-display tracking-[0.22em] safe-bottom">
        ZORYXA MAIL
      </p>
    </div>
  )
}
