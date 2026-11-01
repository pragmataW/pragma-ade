import { ShellTestIds as T } from '@pragma/sdk'
import { useRendererHost } from '@pragma/sdk/renderer'
import { LAYOUT } from '@pragma/ui/tokens'
import { useEffect } from 'react'
import {
  Group,
  Panel,
  type PanelImperativeHandle,
  Separator,
  useDefaultLayout,
  usePanelRef,
} from 'react-resizable-panels'
import { useStore } from 'zustand'
import { useShell } from '../lib/shell-context'
import { useAppShortcuts } from '../lib/use-app-shortcuts'
import { CenterArea } from './CenterArea'
import { CommandPalette } from './CommandPalette'
import { NativeSnapshots } from './NativeSnapshots'
import { RightPanel } from './RightPanel'
import { SettingsView } from './SettingsView'
import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'
import { TitleBar } from './TitleBar'

const LAYOUT_ID = 'shell.main'
const PANE = { sidebar: 'sidebar', center: 'center', right: 'right' } as const
const px = (n: number): string => `${n}px`
const COLLAPSED = px(0)

/** Syncs a panel's collapsed state with the shell store (the panel library is the external system). */
function useCollapsed(ref: React.RefObject<PanelImperativeHandle | null>, collapsed: boolean): void {
  useEffect(() => {
    const panel = ref.current
    if (!panel || panel.isCollapsed() === collapsed) return
    if (collapsed) panel.collapse()
    else panel.expand()
  }, [ref, collapsed])
}

const separatorClass = 'w-px bg-[var(--bd)] outline-none hover:bg-[var(--ac)] data-[separator=active]:bg-[var(--ac)]'

export function Shell() {
  const host = useRendererHost()
  useAppShortcuts(host)
  const sidebarRef = usePanelRef()
  const centerRef = usePanelRef()
  const rightRef = usePanelRef()
  const settingsOpen = useShell((s) => s.settingsOpen)
  const hideRightForView = useStore(
    host.registries.store,
    (s) => s.views.find((v) => v.id === s.activeView)?.hideRightPanel ?? false,
  )
  useCollapsed(
    sidebarRef,
    useShell((s) => s.sidebarCollapsed),
  )
  useCollapsed(rightRef, useShell((s) => s.rightCollapsed) || settingsOpen || hideRightForView)
  useCollapsed(centerRef, useShell((s) => s.rightMaximized) && !settingsOpen)
  const layout = useDefaultLayout({ id: LAYOUT_ID, storage: host.layout.storage, onlySaveAfterUserInteractions: true })
  return (
    <div data-testid={T.shellReady} className="flex h-full flex-col bg-[var(--bg)] text-[var(--tx)]">
      <TitleBar />
      <Group
        id={LAYOUT_ID}
        orientation="horizontal"
        className="min-h-0 flex-1"
        defaultLayout={layout.defaultLayout}
        onLayoutChanged={layout.onLayoutChanged}
      >
        <Panel
          id={PANE.sidebar}
          panelRef={sidebarRef}
          data-testid={T.paneSidebar}
          defaultSize={px(LAYOUT.sidebar)}
          minSize={px(LAYOUT.sidebarMin)}
          collapsible
          collapsedSize={COLLAPSED}
        >
          <Sidebar />
        </Panel>
        <Separator data-testid={T.separatorSidebar} className={separatorClass} />
        <Panel
          id={PANE.center}
          panelRef={centerRef}
          data-testid={T.paneCenter}
          minSize={px(LAYOUT.centerMin)}
          collapsible
          collapsedSize={COLLAPSED}
        >
          {settingsOpen ? <SettingsView /> : <CenterArea />}
        </Panel>
        <Separator data-testid={T.separatorRight} className={separatorClass} />
        <Panel
          id={PANE.right}
          panelRef={rightRef}
          data-testid={T.paneRight}
          defaultSize={px(LAYOUT.rightPanel)}
          minSize={px(LAYOUT.rightPanelMin)}
          collapsible
          collapsedSize={COLLAPSED}
        >
          <RightPanel />
        </Panel>
      </Group>
      <StatusBar />
      <CommandPalette />
      <NativeSnapshots />
    </div>
  )
}
