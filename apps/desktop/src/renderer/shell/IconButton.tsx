import { Button, type ButtonProps } from '@pragma/ui/components/button'
import { Icon } from '@pragma/ui/components/icon'

/**
 * A ghost icon button whose label is an i18n string already translated by the caller. Extra props pass through, so it
 * also works as a Radix `asChild` trigger.
 */
export function IconButton({
  icon,
  label,
  testId,
  pressed,
  ...rest
}: {
  icon: string
  label: string
  testId: string
  pressed?: boolean
} & Omit<ButtonProps, 'children'>) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      data-testid={testId}
      {...rest}
    >
      <Icon name={icon} />
    </Button>
  )
}
