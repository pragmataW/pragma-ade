import { CoreIpc, MODULE_STATE, MODULE_STATE_REASON, type ModuleStatus } from '@pragma/sdk'
import { useLatestAsync, useRendererContext, useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { useState } from 'react'
import { TEST_IDS } from '../contract/testids'

const LIST_SEPARATOR = ', '
const userDisabled = (s: ModuleStatus): boolean =>
  s.state === MODULE_STATE.disabled && s.reason === MODULE_STATE_REASON.user

/** `core.modules.list` plus switching modules on and off; every change applies after a restart (§4.2). */
export function useModuleToggles() {
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
  return {
    statuses: statuses.data ?? [],
    /** What the switch shows: the choice made on this page, else whether the user has not disabled it. */
    enabled: (s: ModuleStatus): boolean => wanted[s.id] ?? !userDisabled(s),
    toggle: (id: string, enabled: boolean) => void toggle(id, enabled),
    restart: { required: restartRequired, affected },
  }
}

/** "Restart required" with the affected modules and a Restart button, once something was switched. */
export function RestartBanner(props: { required: boolean; affected: string[] }) {
  const t = useT()
  const ctx = useRendererContext()
  if (!props.required) return null
  return (
    <div className="mb-3 flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--warn)] bg-[var(--el)] px-3 py-2">
      <div className="flex-1">
        <p>{t('settings-general:modules.restartRequired')}</p>
        {props.affected.length > 0 && (
          <p className="text-[var(--mu)] text-xs">
            {t('settings-general:modules.affected', { list: props.affected.join(LIST_SEPARATOR) })}
          </p>
        )}
      </div>
      <Button data-testid={TEST_IDS.restart} onClick={() => void ctx.ipc.invoke(CoreIpc.appRelaunch, undefined)}>
        {t('settings-general:modules.restart')}
      </Button>
    </div>
  )
}
