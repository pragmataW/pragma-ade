import { CoreIpc, MODULE_STATE, MODULE_STATE_REASON, type ModuleStatus } from '@pragma/sdk'
import { useLatestAsync, useRendererContext, useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { useState } from 'react'
import { TEST_IDS } from '../contract/testids'
import { ModuleRow } from './ModuleRow'

const LIST_SEPARATOR = ', '
const userDisabled = (s: ModuleStatus): boolean =>
  s.state === MODULE_STATE.disabled && s.reason === MODULE_STATE_REASON.user

/** All modules and providers from `core.modules.list`; changes apply after a restart (§4.2). */
export function ModulesPage() {
  const t = useT()
  const ctx = useRendererContext()
  const statuses = useLatestAsync(() => ctx.ipc.invoke(CoreIpc.modulesList, undefined), [ctx])
  const [wanted, setWanted] = useState<Record<string, boolean>>({})
  const [affected, setAffected] = useState<string[]>([])
  const [restartRequired, setRestartRequired] = useState(false)
  const toggle = async (id: string, enabled: boolean) => {
    setWanted((w) => ({ ...w, [id]: enabled }))
    const result = await ctx.ipc.invoke(CoreIpc.modulesSetEnabled, { id, enabled })
    setAffected((a) => [...new Set([...a, ...result.affected])])
    if (result.restartRequired) setRestartRequired(true)
  }
  return (
    <div className="max-w-[820px]">
      {restartRequired && (
        <div className="mb-3 flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--warn)] bg-[var(--el)] px-3 py-2">
          <div className="flex-1">
            <p>{t('settings-general:modules.restartRequired')}</p>
            {affected.length > 0 && (
              <p className="text-[var(--mu)] text-xs">
                {t('settings-general:modules.affected', { list: affected.join(LIST_SEPARATOR) })}
              </p>
            )}
          </div>
          <Button data-testid={TEST_IDS.restart} onClick={() => void ctx.ipc.invoke(CoreIpc.appRelaunch, undefined)}>
            {t('settings-general:modules.restart')}
          </Button>
        </div>
      )}
      <ul className="divide-y divide-[var(--bd)] rounded-[var(--radius-card)] border border-[var(--bd)]">
        {(statuses.data ?? []).map((s) => (
          <ModuleRow
            key={s.id}
            status={s}
            enabled={wanted[s.id] ?? !userDisabled(s)}
            onToggle={(enabled) => void toggle(s.id, enabled)}
          />
        ))}
      </ul>
    </div>
  )
}
