import { DndContext, type DragEndEvent, PointerSensor, pointerWithin, useSensor, useSensors } from '@dnd-kit/core'
import { ShellTestIds as T } from '@pragma/sdk'
import { useRendererHost } from '@pragma/sdk/renderer'
import { LAYOUT } from '@pragma/ui/tokens'
import { type ReactNode, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Group,
  Panel,
  type PanelImperativeHandle,
  Separator,
  useDefaultLayout,
  usePanelRef,
} from 'react-resizable-panels'
import { useStore } from 'zustand'
import { DOCK, DOCK_POSITIONS, type DockPosition, dockLeads, isVerticalDock } from '../lib/dock-layout'
import { Mount, usePortalNode } from '../lib/portal-node'
import { MOVE_DOCK_COMMANDS } from '../lib/shell-commands'
import { useShell, useShellStore } from '../lib/shell-context'
import { useAppShortcuts } from '../lib/use-app-shortcuts'
import { CenterArea } from './CenterArea'
import { CommandPalette } from './CommandPalette'
import { DockDropOverlay } from './DockDropOverlay'
import { NativeSnapshots } from './NativeSnapshots'
import { RightPanel } from './RightPanel'
import { SettingsView } from './SettingsView'
import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'
import { TitleBar } from './TitleBar'

/** Saved pane sizes are per arrangement, so switching sides never applies sizes from another layout. */
const OUTER_ID = 'shell.outer'
const WORK_ID = 'shell.work'
const PANE = { sidebar: 'sidebar', work: 'work', center: 'center', right: 'right' } as const
const ORIENTATION = { horizontal: 'horizontal', vertical: 'vertical' } as const
const RESIZE = 'resize'
/** `view-transition-name`s: each pane glides to its new place when the layout changes. */
const TRANSITION = { sidebar: 'pane-sidebar', center: 'pane-center', dock: 'pane-dock' } as const
/** More than a click: the dock grip still opens nothing on a plain press. */
const DRAG_ACTIVATION_PX = 5
const px = (n: number): string => `${n}px`
const COLLAPSED = px(0)

/** Syncs a panel's collapsed state with the shell store (the panel library is the external system). */
function useCollapsed(ref: React.RefObject<PanelImperativeHandle | null>, collapsed: boolean, arrangement: string) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new arrangement mounts new panels that need the state
  useLayoutEffect(() => {
    const panel = ref.current
    if (!panel || panel.isCollapsed() === collapsed) return
    if (collapsed) panel.collapse()
    else panel.expand()
  }, [ref, collapsed, arrangement])
}

const separatorClass = (vertical: boolean): string =>
  `${vertical ? 'h-px' : 'w-px'} bg-[var(--bd)] outline-none hover:bg-[var(--ac)] data-[separator=active]:bg-[var(--ac)]`

const isDockPosition = (id: unknown): id is DockPosition => DOCK_POSITIONS.includes(id as DockPosition)

/** Drag the dock grip onto an edge of the work area to move the dock there. */
function DockDnd({ children }: { children: ReactNode }) {
  const host = useRendererHost()
  const store = useShellStore()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_PX } }))
  const end = (e: DragEndEvent): void => {
    store.setState({ dockDragging: false })
    const target = e.over?.id
    if (isDockPosition(target)) void host.commands.execute(MOVE_DOCK_COMMANDS[target].id)
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={() => store.setState({ dockDragging: true })}
      onDragCancel={() => store.setState({ dockDragging: false })}
      onDragEnd={end}
    >
      {children}
    </DndContext>
  )
}

export function Shell() {
  const host = useRendererHost()
  useAppShortcuts(host)
  const sidebarRef = usePanelRef()
  const centerRef = usePanelRef()
  const rightRef = usePanelRef()
  const nodes = { sidebar: usePortalNode(), center: usePortalNode(), dock: usePortalNode() }
  const settingsOpen = useShell((s) => s.settingsOpen)
  const sidebarSide = useShell((s) => s.sidebarSide)
  const dockPosition = useShell((s) => s.dockPosition)
  const arrangement = `${sidebarSide}.${dockPosition}`
  const hideRightForView = useStore(
    host.registries.store,
    (s) => s.views.find((v) => v.id === s.activeView)?.hideRightPanel ?? false,
  )
  useCollapsed(
    sidebarRef,
    useShell((s) => s.sidebarCollapsed),
    arrangement,
  )
  useCollapsed(rightRef, useShell((s) => s.rightCollapsed) || settingsOpen || hideRightForView, arrangement)
  useCollapsed(centerRef, useShell((s) => s.rightMaximized) && !settingsOpen, arrangement)
  // Moving a pane can keep its size, which ResizeObserver misses: re-measure the native views' rects.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per arrangement
  useEffect(() => {
    window.dispatchEvent(new Event(RESIZE))
  }, [arrangement])
  const outerId = `${OUTER_ID}.${sidebarSide}`
  const workId = `${WORK_ID}.${dockPosition}`
  const storage = host.layout.storage
  const outer = useDefaultLayout({ id: outerId, storage, onlySaveAfterUserInteractions: true })
  const work = useDefaultLayout({ id: workId, storage, onlySaveAfterUserInteractions: true })
  const vertical = isVerticalDock(dockPosition)

  const sidebar = (
    <Panel
      key={PANE.sidebar}
      id={PANE.sidebar}
      panelRef={sidebarRef}
      data-testid={T.paneSidebar}
      defaultSize={px(LAYOUT.sidebar)}
      minSize={px(LAYOUT.sidebarMin)}
      collapsible
      collapsedSize={COLLAPSED}
    >
      <Mount node={nodes.sidebar} name={TRANSITION.sidebar} />
    </Panel>
  )
  const sidebarSeparator = (
    <Separator key="sidebar-separator" data-testid={T.separatorSidebar} className={separatorClass(false)} />
  )
  const center = (
    <Panel
      key={PANE.center}
      id={PANE.center}
      panelRef={centerRef}
      data-testid={T.paneCenter}
      className="app-pane-center"
      minSize={px(vertical ? LAYOUT.centerMinHeight : LAYOUT.centerMin)}
      collapsible
      collapsedSize={COLLAPSED}
    >
      <Mount node={nodes.center} name={TRANSITION.center} />
    </Panel>
  )
  const dock = (
    <Panel
      key={PANE.right}
      id={PANE.right}
      panelRef={rightRef}
      data-testid={T.paneRight}
      className="app-pane-dock"
      data-dock-position={dockPosition}
      defaultSize={px(vertical ? LAYOUT.dockHeight : LAYOUT.rightPanel)}
      minSize={px(vertical ? LAYOUT.dockHeightMin : LAYOUT.rightPanelMin)}
      collapsible
      collapsedSize={COLLAPSED}
    >
      <Mount node={nodes.dock} name={TRANSITION.dock} />
    </Panel>
  )
  const dockSeparator = (
    <Separator key="dock-separator" data-testid={T.separatorRight} className={separatorClass(vertical)} />
  )
  const workArea = (
    <Panel key={PANE.work} id={PANE.work} minSize={px(LAYOUT.centerMin)}>
      <Group
        key={workId}
        id={workId}
        orientation={vertical ? ORIENTATION.vertical : ORIENTATION.horizontal}
        className="h-full"
        defaultLayout={work.defaultLayout}
        onLayoutChanged={work.onLayoutChanged}
      >
        {dockLeads(dockPosition) ? [dock, dockSeparator, center] : [center, dockSeparator, dock]}
      </Group>
    </Panel>
  )
  return (
    <div data-testid={T.shellReady} className="app-shell flex h-full flex-col bg-[var(--bg)] text-[var(--tx)]">
      <TitleBar />
      <DockDnd>
        <div className="relative min-h-0 flex-1">
          <Group
            key={outerId}
            id={outerId}
            orientation={ORIENTATION.horizontal}
            className="h-full"
            defaultLayout={outer.defaultLayout}
            onLayoutChanged={outer.onLayoutChanged}
          >
            {sidebarSide === DOCK.left ? [sidebar, sidebarSeparator, workArea] : [workArea, sidebarSeparator, sidebar]}
          </Group>
          <DockDropOverlay />
        </div>
        {createPortal(<Sidebar />, nodes.sidebar)}
        {createPortal(settingsOpen ? <SettingsView /> : <CenterArea />, nodes.center)}
        {createPortal(<RightPanel />, nodes.dock)}
      </DockDnd>
      <StatusBar />
      <CommandPalette />
      <NativeSnapshots />
    </div>
  )
}
