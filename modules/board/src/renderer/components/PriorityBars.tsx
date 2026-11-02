import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { PRIORITY_BAR_CLASSES, PRIORITY_BARS } from '../../constants'
import { BOARD_TESTID_ATTRS as A, PRIORITY, type Priority, BOARD_TESTIDS as T } from '../../contract'

/** 0–3 bars; urgent = 3 bars in the error colour. */
export function PriorityBars({ priority }: { priority: Priority }) {
  const t = useT()
  const filled = PRIORITY_BARS[priority]
  const urgent = priority === PRIORITY.urgent
  return (
    <span
      role="img"
      data-testid={T.cardPriority}
      {...{ [A.priority]: priority }}
      aria-label={t(`board:priority.${priority}`)}
      className="inline-flex h-3 items-end gap-px"
    >
      {PRIORITY_BAR_CLASSES.map((height, i) => (
        <span
          key={height}
          className={cn(
            'w-[3px] rounded-[1px]',
            height,
            i < filled ? (urgent ? 'bg-[var(--err)]' : 'bg-[var(--mu)]') : 'bg-[var(--bd2)]',
          )}
        />
      ))}
    </span>
  )
}
