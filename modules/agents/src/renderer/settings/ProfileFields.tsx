import { useT } from '@pragma/sdk/renderer'
import { Input } from '@pragma/ui/components/input'
import { type KeyboardEvent, useEffect, useId, useState } from 'react'
import { COMMAND_CHECK_DEBOUNCE_MS } from '../../constants'
import {
  AGENTS_TESTIDS,
  type AgentProfile,
  agentsIpc,
  type CommandResolution,
  formatArgs,
  RESOLUTION,
  tryParseArgs,
} from '../../contract'
import { getRuntime } from '../runtime'

const MONO_INPUT = '[font-family:var(--font-code)] text-[12px]'
const FIELD_LABEL = 'text-[12px] font-medium text-mu'
const ENTER = 'Enter'

const blurOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
  if (e.key === ENTER) e.currentTarget.blur()
}

/** A text value seeded from the saved profile, re-seeded when the saved value changes. */
function useSavedValue(source: string): [string, (v: string) => void] {
  const [value, setValue] = useState(source)
  useEffect(() => setValue(source), [source])
  return [value, setValue]
}

/** Debounced `agents.resolveCommand` for an unsaved command. */
function useLiveResolution(command: string, saved: string): { command: string; result: CommandResolution } | null {
  const [live, setLive] = useState<{ command: string; result: CommandResolution } | null>(null)
  useEffect(() => {
    const value = command.trim()
    if (value === '' || value === saved) return setLive(null)
    let current = true
    const timer = setTimeout(() => {
      getRuntime()
        .ctx.ipc.invoke(agentsIpc.resolveCommand, { command: value })
        .then((result) => current && setLive({ command: value, result }))
        .catch((e: unknown) => console.warn('agents: resolveCommand failed', e))
    }, COMMAND_CHECK_DEBOUNCE_MS)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [command, saved])
  return live && live.command === command.trim() ? live : null
}

/** Command: `commandOverride ?? stockCommand`; saves on blur/Enter (empty on a built-in → `null`). */
export function CommandField({ profile, onSave }: { profile: AgentProfile; onSave(command: string | null): void }) {
  const t = useT()
  const id = useId()
  const source = profile.commandOverride ?? profile.stockCommand ?? ''
  const [value, setValue] = useSavedValue(source)
  const live = useLiveResolution(value, source)
  const save = () => {
    const v = value.trim()
    if (v === source) return
    if (v === '' && !profile.isBuiltin) return setValue(source)
    onSave(v === '' ? null : v)
  }
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={FIELD_LABEL}>
        {t('agents:settings.command')}
      </label>
      <Input
        id={id}
        data-testid={AGENTS_TESTIDS.commandInput}
        value={value}
        placeholder={profile.stockCommand ?? ''}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={blurOnEnter}
        className={MONO_INPUT}
      />
      {live?.result.status === RESOLUTION.notFound ? (
        <span className="text-[11.5px] text-warn">
          {t('agents:settings.commandNotFound', { command: live.command })}
        </span>
      ) : null}
    </div>
  )
}

/** Arguments: `argsOverride ?? formatArgs(stockArgs)`; live `tryParseArgs`, saved only when it parses. */
export function ArgsField({ profile, onSave }: { profile: AgentProfile; onSave(args: string): void }) {
  const t = useT()
  const id = useId()
  const source = profile.argsOverride ?? formatArgs(profile.stockArgs ?? [])
  const [value, setValue] = useSavedValue(source)
  const parsed = tryParseArgs(value)
  const save = () => {
    if (parsed.ok && value !== source) onSave(value)
  }
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={FIELD_LABEL}>
        {t('agents:settings.arguments')}
      </label>
      <Input
        id={id}
        data-testid={AGENTS_TESTIDS.argsInput}
        value={value}
        aria-invalid={!parsed.ok}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={blurOnEnter}
        className={MONO_INPUT}
      />
      {parsed.ok ? null : (
        <span data-testid={AGENTS_TESTIDS.argsError} className="text-[11.5px] text-err">
          {t('agents:errors.argsInvalid')}
        </span>
      )}
    </div>
  )
}
