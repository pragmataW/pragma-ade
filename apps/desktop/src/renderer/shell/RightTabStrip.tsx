import { CoreCommands, ShellTestIds as T } from '@pragma/sdk'
import { useRendererHost, useT } from '@pragma/sdk/renderer'
import { Icon } from '@pragma/ui/components/icon'
import { cn } from '@pragma/ui/lib/utils'
import { useStore } from 'zustand'
import { NAV_ICON_PX } from '../constants'
import { useShell } from '../lib/shell-context'
import { IconButton } from './IconButton'
import { PlainButton } from './PlainButton'

/** Right dock tabs: icon + label, accent underline when active, count badge (ui-notes). */
export function RightTabStrip() {
  const t = useT()
  const host = useRendererHost()
  const { tabs, activeTab, badges } = useStore(host.registries.store)
  const maximized = useShell((s) => s.rightMaximized)
  return (
    <div className="flex h-[var(--tabstrip-h)] shrink-0 items-stretch border-b border-[var(--bd)] bg-[var(--pn)] pr-1">
      <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto" role="tablist">
        {tabs.map((tab) => (
          <PlainButton
            key={tab.id}
            role="tab"
            aria-selected={tab.id === activeTab}
            data-testid={T.rightTab(tab.id)}
            onClick={() => host.registries.activateRightTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 border-b-2 px-3 text-[var(--mu)] hover:text-[var(--tx)]',
              tab.id === activeTab ? 'border-[var(--ac)] text-[var(--tx)]' : 'border-transparent',
            )}
          >
            <Icon name={tab.icon} size={NAV_ICON_PX} />
            <span>{t(tab.titleKey)}</span>
            {badges[tab.id] !== undefined && (
              <span
                data-testid={T.rightTabBadge(tab.id)}
                className="rounded-full bg-[var(--acs)] px-1.5 text-[10px] text-[var(--act)]"
              >
                {badges[tab.id]}
              </span>
            )}
          </PlainButton>
        ))}
      </div>
      <div className="flex items-center">
        <IconButton
          icon={maximized ? 'minimize-2' : 'maximize-2'}
          label={t('core:titlebar.maximizeRightPanel')}
          testId={T.maximizeRightPanel}
          pressed={maximized}
          onClick={() => void host.commands.execute(CoreCommands.maximizeRightPanel)}
        />
      </div>
    </div>
  )
}
