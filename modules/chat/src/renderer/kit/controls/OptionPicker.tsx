import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Button } from '@pragma/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@pragma/ui/components/dropdown-menu'
import { Switch } from '@pragma/ui/components/switch'
import { ChevronDown, Minus, Plus } from '@pragma/ui/icons'
import type { ComponentType } from 'react'
import { ALIGN_START, ICON_PX, ICON_STROKE, SIZE_ICON_XS, SIZE_SM, VARIANT_GHOST } from '../../../constants'
import {
  CHAT_TESTIDS,
  type ChatOptionDescriptor,
  type ChatSessionApi,
  type ChatSlotComponent,
  type ChatSlotProps,
  OPTION_TYPE,
} from '../../../contract'
import { CHAT_RESPONSIVE } from '../responsive'
import { useChoiceLabel } from './use-choice-label'

export const PICKER_VARIANTS = ['select', 'icon'] as const
export type PickerVariant = (typeof PICKER_VARIANTS)[number]
const [SELECT] = PICKER_VARIANTS
type Icon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>

export const valueKey = (v: unknown): string => JSON.stringify(v)

function EnumPicker({ d, session, icon: IconC, variant }: PickerProps) {
  const t = useT()
  const label = useChoiceLabel()
  const choices = d.values ?? []
  const current = choices.find((c) => c.value === d.current)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={VARIANT_GHOST}
          size={SIZE_SM}
          data-testid={CHAT_TESTIDS.optionPicker(d.key)}
          aria-label={t(d.labelKey)}
          title={t(d.labelKey)}
          className={cn(
            'min-w-0 shrink gap-1 px-2 text-[12px] @max-[479px]/chat:px-1.5',
            current?.warn ? 'text-warn' : 'text-mu',
          )}
        >
          {IconC ? <IconC size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="shrink-0" /> : null}
          {variant === SELECT || !IconC ? (
            <span className={cn('max-w-40', CHAT_RESPONSIVE.compactLabel, IconC && CHAT_RESPONSIVE.label)}>
              {label(current)}
            </span>
          ) : null}
          <ChevronDown
            size={ICON_PX}
            strokeWidth={ICON_STROKE}
            aria-hidden
            className={cn('shrink-0 opacity-60', CHAT_RESPONSIVE.wideOnly)}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={ALIGN_START} className="min-w-44">
        <DropdownMenuRadioGroup
          value={valueKey(d.current)}
          onValueChange={(v) => {
            const choice = choices.find((c) => valueKey(c.value) === v)
            if (choice) void session.setOption(d.key, choice.value)
          }}
        >
          {choices.map((c) => (
            <DropdownMenuRadioItem
              key={valueKey(c.value)}
              value={valueKey(c.value)}
              data-testid={CHAT_TESTIDS.optionValue(d.key, String(c.value))}
              className={cn('text-[12.5px]', c.warn && 'text-warn')}
            >
              {label(c)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function BooleanPicker({ d, session }: PickerProps) {
  const t = useT()
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-mu">
      <Switch
        data-testid={CHAT_TESTIDS.optionPicker(d.key)}
        aria-label={t(d.labelKey)}
        checked={d.current === true}
        onCheckedChange={(v) => void session.setOption(d.key, v)}
      />
      {t(d.labelKey)}
    </span>
  )
}

function NumberPicker({ d, session }: PickerProps) {
  const t = useT()
  const value = typeof d.current === 'number' ? d.current : Number(d.default ?? 0)
  const step = d.step ?? 1
  const set = (v: number) => {
    if ((d.min === undefined || v >= d.min) && (d.max === undefined || v <= d.max)) void session.setOption(d.key, v)
  }
  return (
    <span
      data-testid={CHAT_TESTIDS.optionPicker(d.key)}
      title={t(d.labelKey)}
      className="inline-flex items-center gap-1 text-[12px] text-mu"
    >
      <Button
        variant={VARIANT_GHOST}
        size={SIZE_ICON_XS}
        aria-label={t('chat:option.decrease')}
        onClick={() => set(value - step)}
      >
        <Minus size={ICON_PX} strokeWidth={ICON_STROKE} />
      </Button>
      <span className="min-w-6 text-center tabular-nums text-tx">{value}</span>
      <Button
        variant={VARIANT_GHOST}
        size={SIZE_ICON_XS}
        aria-label={t('chat:option.increase')}
        onClick={() => set(value + step)}
      >
        <Plus size={ICON_PX} strokeWidth={ICON_STROKE} />
      </Button>
    </span>
  )
}

interface PickerProps {
  d: ChatOptionDescriptor
  session: ChatSessionApi
  icon?: Icon
  variant?: PickerVariant
}

const BY_TYPE = {
  [OPTION_TYPE.enum]: EnumPicker,
  [OPTION_TYPE.boolean]: BooleanPicker,
  [OPTION_TYPE.number]: NumberPicker,
} as const

/** The generic control for one described option (enum → menu, boolean → switch, number → stepper). */
export function OptionPicker({
  descriptor,
  session,
  icon,
  variant = SELECT,
}: {
  descriptor: ChatOptionDescriptor
  session: ChatSessionApi
  icon?: Icon
  variant?: PickerVariant
}) {
  const Picker = BY_TYPE[descriptor.type]
  return <Picker d={descriptor} session={session} icon={icon} variant={variant} />
}

/** A toolbar slot for the option `key`; renders nothing when the session does not describe it. */
export function createOptionPicker(opts: { key: string; icon?: Icon; variant?: PickerVariant }): ChatSlotComponent {
  // biome-ignore lint/correctness/noComponentHookFactories: the kit's documented factory (§5.4); called once at module scope per provider definition
  function Picker({ session }: ChatSlotProps) {
    const descriptor = session.transcript.info.options.find((o) => o.key === opts.key)
    if (!descriptor) return null
    return <OptionPicker descriptor={descriptor} session={session} icon={opts.icon} variant={opts.variant} />
  }
  Picker.displayName = `OptionPicker(${opts.key})`
  return Picker
}
