import { DEFAULT_MONOGRAM_PX, MONOGRAM_FONT_RATIO } from '../constants/ui'
import { cn } from '../lib/utils'

/** A rounded square with letters, used as a simple provider mark (§10.1.9). */
export function Monogram({
  letters,
  size = DEFAULT_MONOGRAM_PX,
  className,
}: {
  letters: string
  size?: number
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[var(--radius-chip)] bg-[var(--acs)] font-semibold text-[var(--act)] leading-none',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * MONOGRAM_FONT_RATIO) }}
      aria-hidden
    >
      {letters}
    </span>
  )
}
