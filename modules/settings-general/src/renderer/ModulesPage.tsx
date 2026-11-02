import { ModuleRow } from './ModuleRow'
import { RestartBanner, useModuleToggles } from './module-toggles'

/** All modules and providers from `core.modules.list`; changes apply after a restart (§4.2). */
export function ModulesPage() {
  const modules = useModuleToggles()
  return (
    <div className="max-w-[820px]">
      <RestartBanner {...modules.restart} />
      <ul className="divide-y divide-[var(--bd)] rounded-[var(--radius-card)] border border-[var(--bd)]">
        {modules.statuses.map((s) => (
          <ModuleRow
            key={s.id}
            status={s}
            enabled={modules.enabled(s)}
            onToggle={(enabled) => modules.toggle(s.id, enabled)}
          />
        ))}
      </ul>
    </div>
  )
}
