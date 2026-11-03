import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@pragma/ui/components/dropdown-menu'
import { Check, ChevronDown, Shield, ShieldAlert } from '@pragma/ui/icons'
import { ALIGN_START, BUTTON_TYPE, ICON_PX, ICON_STROKE } from '../../../constants'
import { CHAT_TESTIDS, CHAT_TONE, type ChatOptionChoice, type ChatSlotProps } from '../../../contract'
import { PILL, TONE_BADGE, TONE_DOT } from '../parts/lib/tone'
import { CHAT_RESPONSIVE } from '../responsive'
import { valueKey } from './OptionPicker'
import { useChoiceDescription, useChoiceLabel } from './use-choice-label'
import { permissionModeOf, usePermissionModeSelect } from './use-permission-mode'

const toneOf = (c: ChatOptionChoice | undefined) => c?.tone ?? (c?.warn ? CHAT_TONE.warn : CHAT_TONE.neutral)

function ModeRow({ choice, current }: { choice: ChatOptionChoice; current: boolean }) {
  const label = useChoiceLabel()
  const description = useChoiceDescription()(choice)
  return (
    <span className="flex min-w-0 flex-1 items-start gap-2">
      <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', TONE_DOT[toneOf(choice)])} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1 text-[12.5px] text-tx">
          {label(choice)}
          {choice.dangerous ? (
            <ShieldAlert size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="text-err" />
          ) : null}
        </span>
        {description ? <span className="text-[11.5px] leading-4 text-mu">{description}</span> : null}
      </span>
      {current ? <Check size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="mt-0.5 text-act" /> : null}
    </span>
  )
}

/**
 * The permission mode as a coloured badge (choice `tone`); the menu shows each mode's description, a shield on
 * dangerous ones, and asks before a `requiresConfirm` mode. Shift+Tab in the composer cycles the modes.
 */
export function PermissionModePicker({ session }: ChatSlotProps) {
  const t = useT()
  const label = useChoiceLabel()
  const select = usePermissionModeSelect(session)
  const d = permissionModeOf(session)
  if (!d) return null
  const choices = d.values ?? []
  const current = choices.find((c) => c.value === d.current)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type={BUTTON_TYPE}
          data-testid={CHAT_TESTIDS.permissionMode}
          data-tone={toneOf(current)}
          aria-label={t(d.labelKey)}
          title={`${label(current)} · ${t('chat:permissionMode.hint')}`}
          className={cn(PILL, 'h-6 min-w-0 shrink cursor-pointer hover:brightness-110', TONE_BADGE[toneOf(current)])}
        >
          {current?.dangerous ? (
            <ShieldAlert size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="shrink-0" />
          ) : (
            <Shield size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className={CHAT_RESPONSIVE.narrowOnly} />
          )}
          <span className={cn('max-w-32 truncate', CHAT_RESPONSIVE.label)}>{label(current)}</span>
          <ChevronDown
            size={ICON_PX}
            strokeWidth={ICON_STROKE}
            aria-hidden
            className={cn('shrink-0 opacity-60', CHAT_RESPONSIVE.wideOnly)}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={ALIGN_START} className="w-72">
        <DropdownMenuLabel className="text-[11px] font-semibold tracking-[0.06em] text-mu uppercase">
          {t(d.labelKey)}
        </DropdownMenuLabel>
        {choices.map((c) => (
          <DropdownMenuItem
            key={valueKey(c.value)}
            data-testid={CHAT_TESTIDS.permissionModeValue(String(c.value))}
            onSelect={() => void select(d, c)}
            className="items-start py-1.5"
          >
            <ModeRow choice={c} current={c.value === d.current} />
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="px-2 py-1 text-[11px] text-fa">{t('chat:permissionMode.cycleHint')}</div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
