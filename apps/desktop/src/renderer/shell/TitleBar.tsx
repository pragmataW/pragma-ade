import { CoreCommands, ShellSlots, ShellTestIds as T } from '@pragma/sdk'
import { Slot, useRendererHost, useT } from '@pragma/sdk/renderer'
import { Icon } from '@pragma/ui/components/icon'
import { Kbd } from '@pragma/ui/components/kbd'
import type { CSSProperties } from 'react'
import { SMALL_ICON_PX } from '../constants'
import { useShell } from '../lib/shell-context'
import { useFullScreen } from '../lib/use-full-screen'
import { IconButton } from './IconButton'
import { PlainButton } from './PlainButton'

const MAC = 'darwin'
/** Room for the inset traffic lights; fullscreen hides them. */
const MAC_GUTTER: CSSProperties = { paddingLeft: 'calc(var(--titlebar-h) * 2)' }
/** Windows/Linux draw their window controls over the right end (window-controls overlay). */
const OVERLAY_GUTTER: CSSProperties = {
  paddingRight: 'calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw))',
}

function gutter(platform: string, fullScreen: boolean): CSSProperties | undefined {
  if (platform !== MAC) return OVERLAY_GUTTER
  return fullScreen ? undefined : MAC_GUTTER
}

/**
 * 38px title bar: traffic-light gutter, breadcrumb slot, command search, quick actions (ui-notes). The whole bar drags
 * the window (double-click zooms per the OS setting); only interactive controls opt out (`.app-titlebar` in styles.css).
 */
export function TitleBar() {
  const t = useT()
  const host = useRendererHost()
  const fullScreen = useFullScreen(host)
  const sidebarCollapsed = useShell((s) => s.sidebarCollapsed)
  const rightCollapsed = useShell((s) => s.rightCollapsed)
  const run = (id: string) => () => void host.commands.execute(id)
  return (
    <header
      data-testid={T.titlebar}
      className="app-titlebar flex h-[var(--titlebar-h)] shrink-0 items-center gap-2 border-b border-[var(--bd)] bg-[var(--sb)] px-2 [-webkit-app-region:drag]"
      style={gutter(host.appInfo.platform, fullScreen)}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Slot id={ShellSlots.titlebarLeft} />
      </div>
      <PlainButton
        data-testid={T.openCommandPalette}
        onClick={run(CoreCommands.commandPalette)}
        className="flex h-6 w-[min(420px,40vw)] items-center gap-2 rounded-[var(--radius-button)] border border-[var(--bd)] bg-[var(--el)] px-2 text-[var(--mu)] text-xs"
      >
        <Icon name="search" size={SMALL_ICON_PX} />
        <span className="flex-1 text-left">{t('core:titlebar.search')}</span>
        <Kbd>{t('core:titlebar.paletteShortcut')}</Kbd>
      </PlainButton>
      <div className="flex flex-1 items-center justify-end gap-1">
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
