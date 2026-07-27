import type { Category } from '../../shared/types'

const chipBase =
  'shrink-0 rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap min-h-[40px] transition'

export default function CategoryChips(props: {
  categories: Category[]
  active: string | null
  onChange: (key: string | null) => void
  counts?: Record<string, number>
}) {
  const { categories, active, onChange, counts } = props
  const total = counts ? Object.values(counts).reduce((sum, n) => sum + n, 0) : undefined

  return (
    <div
      className="flex gap-2 overflow-x-auto"
      style={{ scrollbarWidth: 'none' }}
      role="tablist"
      aria-label="Mail categories"
    >
      <button
        type="button"
        role="tab"
        aria-selected={active === null}
        onClick={() => onChange(null)}
        className={
          chipBase +
          (active === null ? ' bg-navy text-white' : ' bg-paper text-muted border border-line')
        }
      >
        All
        {total !== undefined && <span className="ml-1.5 text-xs opacity-60">{total}</span>}
      </button>

      {categories.map((c) => {
        const isActive = active === c.key
        const count = counts?.[c.key]
        return (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(c.key)}
            className={chipBase}
            style={
              isActive
                ? { backgroundColor: c.color, color: '#FFFFFF' }
                : { backgroundColor: c.color + '1F', color: c.color }
            }
          >
            {c.label}
            {count !== undefined && <span className="ml-1.5 text-xs opacity-60">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
