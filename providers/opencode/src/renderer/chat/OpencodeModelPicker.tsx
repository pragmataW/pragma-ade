import { CHAT_OPTION_KEYS, type ChatOptionChoice } from '@pragma/module-chat/contract'
import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Button } from '@pragma/ui/components/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@pragma/ui/components/command'
import { Popover, PopoverContent, PopoverTrigger } from '@pragma/ui/components/popover'
import { Check, ChevronDown, Cpu, Settings2, TriangleAlert } from '@pragma/ui/icons'
import { useState } from 'react'
import {
  ALIGN_START,
  BUTTON_TYPE,
  ICON_PX,
  ICON_STROKE,
  MODEL_I18N,
  OPENCODE_CHAT_TESTIDS,
  SIZE_SM,
  VARIANT_GHOST,
} from './constants'
import { CHAT_RESPONSIVE, type ChatSlotProps, useChatHost } from './kit'
import { useOpenProviderSettings } from './use-open-settings'

const OTHER_GROUP = ''

/** Choices grouped by their provider (the choice `description`), in the adapter's order. */
function groupsOf(choices: readonly ChatOptionChoice[]): [string, ChatOptionChoice[]][] {
  const groups = new Map<string, ChatOptionChoice[]>()
  for (const c of choices) {
    const key = c.description ?? OTHER_GROUP
    groups.set(key, [...(groups.get(key) ?? []), c])
  }
  return [...groups]
}

function ModelRow({ choice, current }: { choice: ChatOptionChoice; current: boolean }) {
  const t = useT()
  return (
    <span className="flex min-w-0 flex-1 items-start gap-2">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('flex items-center gap-1.5 truncate text-[12.5px]', choice.warn ? 'text-warn' : 'text-tx')}>
          {choice.warn ? <TriangleAlert size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden /> : null}
          <span className="truncate">{choice.label ?? String(choice.value)}</span>
        </span>
        {choice.descriptionKey ? (
          <span className="text-[11px] leading-4 text-mu">{t(choice.descriptionKey)}</span>
        ) : null}
      </span>
      {current ? <Check size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="mt-0.5 text-act" /> : null}
    </span>
  )
}

/**
 * The model menu: searchable, grouped by provider (only usable providers are listed), with re-auth and local-model
 * hints and a link to the provider connections page.
 */
export function OpencodeModelPicker({ session }: ChatSlotProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const openSettings = useOpenProviderSettings(useChatHost())
  const d = session.transcript.info.options.find((o) => o.key === CHAT_OPTION_KEYS.model)
  if (!d) return null
  const choices = d.values ?? []
  const current = choices.find((c) => c.value === d.current)
  const pick = (c: ChatOptionChoice) => {
    setOpen(false)
    if (c.value !== d.current) void session.setOption(d.key, c.value)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={VARIANT_GHOST}
          size={SIZE_SM}
          data-testid={OPENCODE_CHAT_TESTIDS.modelPicker}
          aria-label={t(d.labelKey)}
          title={current?.description ? `${current.description} · ${current.label ?? ''}` : t(d.labelKey)}
          className={cn('min-w-0 shrink gap-1 px-2 text-[12px]', current?.warn ? 'text-warn' : 'text-mu')}
        >
          {current?.warn ? (
            <TriangleAlert size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden />
          ) : (
            <Cpu size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden />
          )}
          <span className={cn('max-w-44', CHAT_RESPONSIVE.compactLabel, CHAT_RESPONSIVE.label)}>
            {current?.label ?? t(MODEL_I18N.none)}
          </span>
          <ChevronDown
            size={ICON_PX}
            strokeWidth={ICON_STROKE}
            aria-hidden
            className={cn('opacity-60', CHAT_RESPONSIVE.wideOnly)}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={ALIGN_START} className="w-80 p-0">
        <Command>
          <CommandInput placeholder={t(MODEL_I18N.search)} className="text-[12.5px]" />
          <CommandList className="max-h-80">
            <CommandEmpty className="py-4 text-center text-[12px] text-mu">{t(MODEL_I18N.empty)}</CommandEmpty>
            {groupsOf(choices).map(([group, items]) => (
              <CommandGroup key={group} heading={group || t(MODEL_I18N.other)}>
                {items.map((c) => (
                  <CommandItem
                    key={String(c.value)}
                    value={`${group} ${c.label ?? ''} ${String(c.value)}`}
                    data-testid={OPENCODE_CHAT_TESTIDS.modelOption(String(c.value))}
                    onSelect={() => pick(c)}
                    className="items-start py-1.5"
                  >
                    <ModelRow choice={c} current={c.value === d.current} />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
          {openSettings ? (
            <>
              <CommandSeparator />
              <button
                type={BUTTON_TYPE}
                data-testid={OPENCODE_CHAT_TESTIDS.manageProviders}
                onClick={() => {
                  setOpen(false)
                  openSettings()
                }}
                className="flex h-8 w-full items-center gap-2 px-3 text-left text-[12px] text-mu hover:bg-hv hover:text-tx"
              >
                <Settings2 size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden />
                {t(MODEL_I18N.manage)}
              </button>
            </>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
