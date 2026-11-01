import { cn } from '@pragma/ui'
import { Button } from '@pragma/ui/components/button'
import { Icon } from '@pragma/ui/components/icon'
import { cva } from 'class-variance-authority'
import { BUTTON_TYPE, GHOST_VARIANT, TOOL_ICON_PX } from '../constants'

const toolButton = cva('shrink-0 text-[var(--mu)] hover:text-[var(--tx)] disabled:opacity-40', {
  variants: { active: { true: 'text-[var(--act)] ring-1 ring-[var(--ac)] ring-inset', false: '' } },
  defaultVariants: { active: false },
})

/** Compact icon button; the label is the tooltip (native, so it shows above the page view) and the a11y name. */
export function ToolButton(p: {
  icon: string
  label: string
  testId: string
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  className?: string
}) {
  return (
    <Button
      type={BUTTON_TYPE}
      size="icon-xs"
      variant={GHOST_VARIANT}
      title={p.label}
      aria-label={p.label}
      aria-pressed={p.active}
      data-testid={p.testId}
      disabled={p.disabled}
      onClick={p.onClick}
      className={cn(toolButton({ active: p.active ?? false }), p.className)}
    >
      <Icon name={p.icon} size={TOOL_ICON_PX} />
    </Button>
  )
}
