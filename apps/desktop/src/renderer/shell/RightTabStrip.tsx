import { CoreCommands, ShellTestIds as T } from '@pragma/sdk'
import { useRendererHost, useT } from '@pragma/sdk/renderer'
import { Icon } from '@pragma/ui/components/icon'
import { cn } from '@pragma/ui/lib/utils'
import { useStore } from 'zustand'
import { NAV_ICON_PX } from '../constants'
import { useShell } from '../lib/shell-context'
import { DockControls } from './DockControls'
import { IconButton } from './IconButton'
import { PlainButton } from './PlainButton'

/**
 * Right dock tabs: icon only (name in tooltip + aria-label), accent underline when active,
 * count badge as a pill over the icon (ui-notes, user decision 2026-11-02).
 */
export function RightTabStrip() {
  const t = useT()
  const host = useRendererHost()
  const { tabs, activeTab, badges } = useStore(host.registries.store)
  const maximized = useShell((s) => s.rightMaximized)
  return (
    <div className="flex h-[var(--tabstrip-h)] shrink-0 items-stretch border-b border-[var(--bd)] bg-[var(--pn)] pr-1">
      <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto" role="tablist">
        {tabs.map((tab) => {
          const name = t(tab.titleKey)
          const badge = badges[tab.id]
          return (
            <PlainButton
              key={tab.id}
              role="tab"
              aria-selected={tab.id === activeTab}
              aria-label={name}
              title={name}
              data-testid={T.rightTab(tab.id)}
              onClick={() => host.registries.activateRightTab(tab.id)}
              className={cn(
                'flex items-center justify-center border-b-2 px-3 text-[var(--mu)] hover:text-[var(--tx)]',
                badge !== undefined && 'pr-5',
                tab.id === activeTab ? 'border-[var(--ac)] text-[var(--tx)]' : 'border-transparent',
              )}
            >
              <span className="relative flex">
                <Icon name={tab.icon} size={NAV_ICON_PX} />
                {badge !== undefined && (
                  <span
                    data-testid={T.rightTabBadge(tab.id)}
                    className="-top-1.5 absolute left-2.5 h-3.5 min-w-3.5 rounded-full bg-[var(--acs)] ring-1 ring-[var(--pn)] px-1 text-center font-medium text-[9px] text-[var(--act)] leading-3.5 tabular-nums"
                  >
                    {badge}
                  </span>
                )}
              </span>
            </PlainButton>
          )
        })}
      </div>
      <div className="flex items-center gap-0.5">
        <DockControls />
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
