import type { ComponentProps, ReactNode } from 'react'
import { BUTTON_TYPE, EMPTY_STATE_ICON_PX, PRIMARY_BUTTON_VARIANT, SECONDARY_BUTTON_VARIANT } from '../constants/ui'
import { cn } from '../lib/utils'
import { Button } from './button'
import { Icon } from './icon'
import { Kbd, KbdGroup } from './kbd'

export interface EmptyStateAction {
  /** Already-translated button label (@pragma/ui stays i18n-free). */
  label: string
  onClick(): void
  /** Optional lucide icon (kebab-case) drawn before the label. */
  icon?: string
  testId?: string
}

export interface EmptyStateHint {
  /** Key caps, e.g. `['⌘', 'K']`. */
  keys: readonly string[]
  /** Already-translated text after the keys, e.g. "to open the command palette". */
  label: string
}

export interface EmptyStateProps extends Omit<ComponentProps<'div'>, 'title'> {
  /** Lucide icon name (kebab-case), drawn in a soft rounded tile. */
  icon: string
  title: ReactNode
  description?: ReactNode
  primaryAction?: EmptyStateAction
  secondaryAction?: EmptyStateAction
  hint?: EmptyStateHint
  /** `error` tints the tile red (failed loads); `busy` spins the icon (loading states). */
  error?: boolean
  busy?: boolean
  /** Tighter spacing for narrow side panels and inline lists. */
  compact?: boolean
  testId?: string
}

function ActionButton({ action, primary }: { action: EmptyStateAction; primary: boolean }) {
  return (
    <Button
      type={BUTTON_TYPE}
      size="sm"
      variant={primary ? PRIMARY_BUTTON_VARIANT : SECONDARY_BUTTON_VARIANT}
      data-testid={action.testId}
      onClick={() => action.onClick()}
    >
      {action.icon ? <Icon name={action.icon} /> : null}
      {action.label}
    </Button>
  )
}

function IconTile({ icon, error, busy }: { icon: string; error: boolean; busy: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-card)] border',
        error
          ? 'border-[color-mix(in_srgb,var(--err)_30%,transparent)] bg-[color-mix(in_srgb,var(--err)_10%,transparent)] text-[var(--err)]'
          : 'border-[var(--bd)] bg-[var(--hv)] text-[var(--mu)]',
      )}
    >
      <Icon name={icon} size={EMPTY_STATE_ICON_PX} className={busy ? 'motion-safe:animate-spin' : undefined} />
    </span>
  )
}

function Actions({ primary, secondary }: { primary?: EmptyStateAction; secondary?: EmptyStateAction }) {
  if (!primary && !secondary) return null
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {primary ? <ActionButton action={primary} primary /> : null}
      {secondary ? <ActionButton action={secondary} primary={false} /> : null}
    </div>
  )
}

function Hint({ hint }: { hint: EmptyStateHint }) {
  return (
    <p className="flex items-center gap-1.5 text-[11px] text-[var(--fa)]">
      <KbdGroup>
        {hint.keys.map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </KbdGroup>
      <span>{hint.label}</span>
    </p>
  )
}

/**
 * A designed placeholder for empty, loading or failed areas: icon tile, title, short description, optional
 * primary/secondary actions and a keyboard hint. Fades in (skipped under prefers-reduced-motion).
 */
export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  hint,
  error = false,
  busy = false,
  compact = false,
  testId,
  className,
  ...rest
}: EmptyStateProps) {
  return (
    <div
      data-testid={testId}
      data-slot="empty-state"
      data-error={error || undefined}
      aria-busy={busy || undefined}
      className={cn(
        'flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 text-center',
        compact ? 'px-4 py-6' : 'h-full p-6',
        'motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:animate-in',
        'motion-safe:duration-[var(--motion-duration-base,160ms)] motion-safe:ease-[var(--motion-ease-out,cubic-bezier(0.2,0,0,1))]',
        className,
      )}
      {...rest}
    >
      <IconTile icon={icon} error={error} busy={busy} />
      <div className="flex max-w-[300px] flex-col gap-1">
        <p className="font-semibold text-[13px] text-[var(--tx)] leading-[1.4]">{title}</p>
        {description ? <p className="text-[12px] text-[var(--mu)] leading-[1.5]">{description}</p> : null}
      </div>
      <Actions primary={primaryAction} secondary={secondaryAction} />
      {hint ? <Hint hint={hint} /> : null}
    </div>
  )
}
