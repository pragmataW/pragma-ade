import { MODULE_STATE, type ModuleStatus } from '@pragma/sdk'
import { useT } from '@pragma/sdk/renderer'
import { Badge } from '@pragma/ui/components/badge'
import { Switch } from '@pragma/ui/components/switch'
import { cn } from '@pragma/ui/lib/utils'
import { OUTLINE_VARIANT } from '../constants'
import { TEST_IDS } from '../contract/testids'

const LIST_SEPARATOR = ', '

/** One module: name, id, version, kind, state (with reason) and dependencies; core modules cannot be switched off. */
export function ModuleRow({
  status,
  enabled,
  onToggle,
}: {
  status: ModuleStatus
  enabled: boolean
  onToggle(enabled: boolean): void
}) {
  const t = useT()
  const name = t(status.displayNameKey)
  const deps = [...status.dependsOn, ...status.optionalDependsOn]
  return (
    <li data-testid={TEST_IDS.moduleRow(status.id)} className="flex items-start gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{name}</span>
          <code className="font-[var(--font-code)] text-[var(--mu)] text-xs">{status.id}</code>
          <span className="text-[var(--fa)] text-xs">{status.version}</span>
          <Badge variant={OUTLINE_VARIANT}>{t(`settings-general:modules.kind.${status.kind}`)}</Badge>
          {status.core && <Badge variant="secondary">{t('settings-general:modules.core')}</Badge>}
          <Badge
            data-testid={TEST_IDS.moduleState(status.id)}
            data-state-value={status.state}
            variant={OUTLINE_VARIANT}
            className={cn(
              status.state === MODULE_STATE.failed && 'border-[var(--err)] text-[var(--err)]',
              status.state === MODULE_STATE.active && 'border-[var(--ok)] text-[var(--ok)]',
            )}
          >
            {status.reason
              ? t(`settings-general:modules.reason.${status.reason}`)
              : t(`settings-general:modules.state.${status.state}`)}
          </Badge>
        </div>
        {deps.length > 0 && (
          <p className="mt-0.5 text-[var(--mu)] text-xs">
            {t('settings-general:modules.dependsOn', { list: deps.join(LIST_SEPARATOR) })}
          </p>
        )}
      </div>
      <Switch
        data-testid={TEST_IDS.moduleToggle(status.id)}
        aria-label={t('settings-general:modules.toggle', { name })}
        checked={enabled}
        disabled={status.core}
        onCheckedChange={onToggle}
      />
    </li>
  )
}
