import { useT } from '@pragma/sdk/renderer'
import { Icon } from '@pragma/ui/components/icon'
import { Input } from '@pragma/ui/components/input'
import { useEffect, useState } from 'react'
import { ICON_SM, ICONS } from '../../constants'
import { AGENTS_TESTIDS, envSchema, type ProfileEnv } from '../../contract'
import { IconButton, QuietButton } from '../lib/buttons'

interface Row {
  name: string
  value: string
}

const MONO_INPUT = '[font-family:var(--font-code)] text-[12px]'
const toRows = (env: ProfileEnv): Row[] => Object.entries(env).map(([name, value]) => ({ name, value }))
const isBlank = (r: Row) => r.name.trim() === '' && r.value === ''

/** Rows → env, or null when a row has a value but no name or the contract rejects a name/value. */
function toEnv(rows: readonly Row[]): ProfileEnv | null {
  const filled = rows.filter((r) => !isBlank(r))
  if (filled.some((r) => r.name.trim() === '')) return null
  const parsed = envSchema.safeParse(Object.fromEntries(filled.map((r) => [r.name.trim(), r.value])))
  return parsed.success ? parsed.data : null
}

/** Profile environment rows; validated with the contract's `envSchema`, saved on blur. */
export function EnvEditor({ env, onSave }: { env: ProfileEnv; onSave(env: ProfileEnv): void }) {
  const t = useT()
  const source = JSON.stringify(env)
  const [rows, setRows] = useState<Row[]>(() => toRows(env))
  const [invalid, setInvalid] = useState(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-sync only when the saved env changes
  useEffect(() => {
    setRows(toRows(env))
    setInvalid(false)
  }, [source])
  const commit = (next: readonly Row[]) => {
    const value = toEnv(next)
    setInvalid(value === null)
    if (value !== null && JSON.stringify(value) !== source) onSave(value)
  }
  const edit = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const remove = (i: number) => {
    const next = rows.filter((_, j) => j !== i)
    setRows(next)
    commit(next)
  }
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity until they are named
        <div key={i} data-testid={AGENTS_TESTIDS.envRow} className="flex items-center gap-1.5">
          <Input
            data-testid={AGENTS_TESTIDS.envName}
            aria-label={t('agents:settings.variableName')}
            placeholder={t('agents:settings.variableName')}
            value={r.name}
            onChange={(e) => edit(i, { name: e.target.value })}
            onBlur={() => commit(rows)}
            className={MONO_INPUT}
          />
          <Input
            data-testid={AGENTS_TESTIDS.envValue}
            aria-label={t('agents:settings.variableValue')}
            placeholder={t('agents:settings.variableValue')}
            value={r.value}
            onChange={(e) => edit(i, { value: e.target.value })}
            onBlur={() => commit(rows)}
            className={MONO_INPUT}
          />
          <IconButton
            data-testid={AGENTS_TESTIDS.envRemove}
            aria-label={t('agents:settings.removeVariable')}
            onClick={() => remove(i)}
          >
            <Icon name={ICONS.remove} size={ICON_SM} />
          </IconButton>
        </div>
      ))}
      {invalid ? (
        <div data-testid={AGENTS_TESTIDS.envError} className="text-[12px] text-err">
          {t('agents:errors.envInvalid')}
        </div>
      ) : null}
      <div>
        <QuietButton
          data-testid={AGENTS_TESTIDS.addVariable}
          onClick={() => setRows((rs) => [...rs, { name: '', value: '' }])}
        >
          <Icon name={ICONS.add} size={ICON_SM} />
          {t('agents:settings.addVariable')}
        </QuietButton>
      </div>
    </div>
  )
}
