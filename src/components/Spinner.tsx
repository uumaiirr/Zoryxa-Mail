export default function Spinner(props: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div
        className="w-8 h-8 rounded-full border-[3px] border-line border-t-navy animate-spin"
        role="status"
        aria-label={props.label ?? 'Loading'}
      />
      {props.label && <p className="text-sm text-muted mt-3">{props.label}</p>}
    </div>
  )
}

export function InlineSpinner() {
  return (
    <span
      className="inline-block w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin align-middle"
      aria-hidden="true"
    />
  )
}
