import type { ReactNode } from 'react'

export default function EmptyState(props: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card p-8 text-center">
      <svg
        className="mx-auto mb-4 text-line"
        width="56"
        height="56"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="4" width="20" height="16" rx="3" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
      <h2 className="font-semibold tracking-tight">{props.title}</h2>
      {props.hint && <p className="text-sm text-muted mt-1">{props.hint}</p>}
      {props.action && <div className="mt-4 flex justify-center">{props.action}</div>}
    </div>
  )
}
