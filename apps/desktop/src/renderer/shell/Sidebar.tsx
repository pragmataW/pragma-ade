import { CoreCommands, ShellSlots, ShellTestIds as T } from '@pragma/sdk'
import { Slot, useRendererHost, useT } from '@pragma/sdk/renderer'
import { Icon } from '@pragma/ui/components/icon'
import { NAV_ICON_PX } from '../constants'
import { PlainButton } from './PlainButton'

/** Left sidebar: `sidebar.main` (01's project tree), `sidebar.footer`, and the Settings entry. */
export function Sidebar() {
  const t = useT()
  const host = useRendererHost()
  return (
    <nav className="flex h-full flex-col bg-[var(--sb)]">
      <div className="min-h-0 flex-1 overflow-auto">
        <Slot id={ShellSlots.sidebarMain} />
      </div>
      <div className="flex flex-col gap-1 border-t border-[var(--bd)] p-2">
        <Slot id={ShellSlots.sidebarFooter} />
        <PlainButton
          data-testid={T.openSettings}
          onClick={() => void host.commands.execute(CoreCommands.openSettings)}
          className="flex h-[var(--row-h)] items-center gap-2 rounded-[var(--radius-button)] px-2 text-left text-[var(--mu)] hover:bg-[var(--hv)] hover:text-[var(--tx)]"
        >
          <Icon name="settings" size={NAV_ICON_PX} />
          {t('core:sidebar.settings')}
        </PlainButton>
      </div>
    </nav>
  )
}
