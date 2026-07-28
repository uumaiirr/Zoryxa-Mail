// The ZORYXA Z mark — locked brand asset, three-segment angular construction.
// variant 'silver' = metallic gradient (hero use on Deep Matte Black),
// 'blue' = Electric Blue flat, 'current' = inherits text color (flat variants
// per the approved Color Variations sheet).
let uid = 0

export default function ZoryxaLogo(props: {
  size?: number
  variant?: 'silver' | 'blue' | 'current'
  className?: string
}) {
  const { size = 40, variant = 'current', className } = props
  const id = `zx-${(uid = (uid + 1) % 1000)}`
  const fill =
    variant === 'silver' ? `url(#${id}-g)` : variant === 'blue' ? '#3B82F6' : 'currentColor'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Zoryxa"
    >
      {variant === 'silver' && (
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F4F6F9" />
            <stop offset="0.45" stopColor="#D9DCE3" />
            <stop offset="0.55" stopColor="#AEB4BF" />
            <stop offset="1" stopColor="#DDE1E8" />
          </linearGradient>
        </defs>
      )}
      <mask id={`${id}-m`}>
        <polyline
          points="26,24 74,24 26,76 74,76"
          fill="none"
          stroke="#fff"
          strokeWidth="17"
        />
        <line x1="88" y1="12" x2="54" y2="48" stroke="#000" strokeWidth="5" />
        <line x1="46" y1="52" x2="12" y2="88" stroke="#000" strokeWidth="5" />
      </mask>
      <rect width="100" height="100" fill={fill} mask={`url(#${id}-m)`} />
    </svg>
  )
}
