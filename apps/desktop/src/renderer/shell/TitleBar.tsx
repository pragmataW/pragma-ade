import { CoreCommands, ShellSlots, ShellTestIds as T } from '@pragma/sdk'
import { Slot, useRendererHost, useT } from '@pragma/sdk/renderer'
import { Icon } from '@pragma/ui/components/icon'
import { Kbd } from '@pragma/ui/components/kbd'
import { SMALL_ICON_PX } from '../constants'
import { useShell } from '../lib/shell-context'
import { IconButton } from './IconButton'
import { PlainButton } from './PlainButton'

const MAC = 'darwin'

/** 38px title bar: traffic-light gutter, breadcrumb slot, command search, quick actions (ui-notes). */
export function TitleBar() {
  const t = useT()
  const host = useRendererHost()
  const sidebarCollapsed = useShell((s) => s.sidebarCollapsed)
  const rightCollapsed = useShell((s) => s.rightCollapsed)
  const run = (id: string) => () => void host.commands.execute(id)
  const isMac = host.appInfo.platform === MAC
  return (
    <header
      className="flex h-[var(--titlebar-h)] shrink-0 items-center gap-2 border-b border-[var(--bd)] bg-[var(--sb)] px-2 [-webkit-app-region:drag]"
      style={{ paddingLeft: isMac ? 'calc(var(--titlebar-h) * 2)' : undefined }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 [-webkit-app-region:no-drag]">
        <Slot id={ShellSlots.titlebarLeft} />
      </div>
      <PlainButton
        data-testid={T.openCommandPalette}
        onClick={run(CoreCommands.commandPalette)}
        className="flex h-6 w-[min(420px,40vw)] items-center gap-2 rounded-[var(--radius-button)] border border-[var(--bd)] bg-[var(--el)] px-2 text-[var(--mu)] text-xs [-webkit-app-region:no-drag]"
      >
        <Icon name="search" size={SMALL_ICON_PX} />
        <span className="flex-1 text-left">{t('core:titlebar.search')}</span>
        <Kbd>{t('core:titlebar.paletteShortcut')}</Kbd>
      </PlainButton>
      <div className="flex flex-1 items-center justify-end gap-1 [-webkit-app-region:no-drag]">
        <Slot id={ShellSlots.titlebarRight} />
        <IconButton
          icon="panel-left"
          label={t('core:titlebar.toggleSidebar')}
          testId={T.toggleSidebar}
          pressed={!sidebarCollapsed}
          onClick={run(CoreCommands.toggleSidebar)}
        />
        <IconButton
          icon="panel-right"
          label={t('core:titlebar.toggleRightPanel')}
          testId={T.toggleRightPanel}
          pressed={!rightCollapsed}
          onClick={run(CoreCommands.toggleRightPanel)}
        />
      </div>
    </header>
  )
}
