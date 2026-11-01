import { Button } from '@pragma/ui/components/button'
import { Icon } from '@pragma/ui/components/icon'

/** A ghost icon button whose label is an i18n string already translated by the caller. */
export function IconButton({
  icon,
  label,
  testId,
  pressed,
  onClick,
}: {
  icon: string
  label: string
  testId: string
  pressed?: boolean
  onClick(): void
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      data-testid={testId}
      onClick={onClick}
    >
      <Icon name={icon} />
    </Button>
  )
}
