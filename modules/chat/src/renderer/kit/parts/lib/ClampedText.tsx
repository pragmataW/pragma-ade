import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { useState } from 'react'
import { BUTTON_TYPE, NEWLINE, TEXT_CLAMP_CHARS, TEXT_CLAMP_LINES } from '../../../../constants'

/** Long unbroken tokens (URLs, hashes, base64) wrap instead of widening their box. */
const WRAP_ANYWHERE = 'wrap-anywhere'

/** Line-clamp box; the line count comes from `TEXT_CLAMP_LINES` (inline `-webkit-line-clamp`). */
const CLAMP_BOX = 'overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical]'

/** Expanded text in a fixed-size panel scrolls in place instead of pushing the rest of the panel out. */
const BOUNDED_OPEN = 'max-h-60 overflow-y-auto'

const isLongText = (text: string): boolean =>
  text.length > TEXT_CLAMP_CHARS || text.split(NEWLINE).length > TEXT_CLAMP_LINES

/**
 * Agent-written text (a task's prompt, summary, description): clamped to a few lines with "Show more" when long;
 * `bounded` keeps the expanded text inside a scrolling box (for the fixed-height Tasks panel).
 */
export function ClampedText({
  text,
  bounded = false,
  className,
  testId,
}: {
  text: string
  bounded?: boolean
  className?: string
  testId?: string
}) {
  const t = useT()
  const long = isLongText(text)
  const [open, setOpen] = useState(false)
  const clamped = long && !open
  return (
    <div data-testid={testId} className={cn('min-w-0', className)}>
      <p
        data-clamped={clamped || undefined}
        style={clamped ? { WebkitLineClamp: TEXT_CLAMP_LINES } : undefined}
        className={cn('whitespace-pre-wrap', WRAP_ANYWHERE, clamped && CLAMP_BOX, open && bounded && BOUNDED_OPEN)}
      >
        {text}
      </p>
      {long ? (
        <button
          type={BUTTON_TYPE}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="mt-1 text-[11.5px] text-act hover:underline"
        >
          {t(open ? 'chat:tasks.showLess' : 'chat:tasks.showMore')}
        </button>
      ) : null}
    </div>
  )
}
