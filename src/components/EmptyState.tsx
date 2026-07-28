import type { ReactNode } from 'react'
import ZoryxaLogo from './ZoryxaLogo'

export default function EmptyState(props: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card p-8 text-center relative overflow-hidden">
      {/* Faint Z watermark */}
      <div
        className="absolute -right-6 -bottom-8 opacity-[0.05] pointer-events-none"
        aria-hidden="true"
      >
        <ZoryxaLogo size={160} variant="current" />
      </div>
      <div className="relative">
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-goldsoft/60 flex items-center justify-center text-navydeep">
          <ZoryxaLogo size={30} variant="current" />
        </div>
        <h2 className="font-display font-semibold text-lg tracking-tight">{props.title}</h2>
        {props.hint && <p className="text-sm text-muted mt-1.5">{props.hint}</p>}
        {props.action && <div className="mt-4 flex justify-center">{props.action}</div>}
      </div>
    </div>
  )
}
