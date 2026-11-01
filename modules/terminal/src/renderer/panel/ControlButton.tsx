import { cn } from '@pragma/ui'
import { Icon } from '@pragma/ui/components/icon'
import { TAB_CONTROL_SIZE_PX, TAB_ICON_PX } from '../../constants'

const controlStyle = { width: TAB_CONTROL_SIZE_PX, height: TAB_CONTROL_SIZE_PX }

/** A 28px icon button (tab strip actions, tab and pane close). */
export function ControlButton(p: {
  icon: string
  label: string
  testId?: string
  onClick(): void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      data-testid={p.testId}
      aria-label={p.label}
      title={p.label}
      disabled={p.disabled}
      onClick={(e) => {
        e.stopPropagation()
        p.onClick()
      }}
      style={controlStyle}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-[var(--radius-button)] text-mu hover:bg-hv hover:text-tx',
        'disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-mu',
        p.className,
      )}
    >
      <Icon name={p.icon} size={TAB_ICON_PX} />
    </button>
  )
}
