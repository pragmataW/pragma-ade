import { useRendererHost, useT } from '@pragma/sdk/renderer'
import { type ReactNode, useEffect, useLayoutEffect } from 'react'
import {
  Group,
  Panel,
  type PanelImperativeHandle,
  Separator,
  useDefaultLayout,
  usePanelRef,
} from 'react-resizable-panels'
import {
  DIFF_MIN_WIDTH_PX,
  SPLIT_LAYOUT_ID,
  TREE_COLLAPSED_LAYOUT_KEY,
  TREE_COLLAPSED_PX,
  TREE_MAX_WIDTH_PX,
  TREE_MIN_WIDTH_PX,
  TREE_WIDTH_PX,
} from '../constants'
import { GitChangesTestIds as T } from '../contract'
import { useGitChangesStore } from './store'

const PANE = { tree: 'tree', diff: 'diff' } as const
const ORIENTATION = 'horizontal'
const COLLAPSED = '1'
const EXPANDED = '0'
const px = (n: number): string => `${n}px`
const SEPARATOR_CLASS =
  'w-px bg-[var(--bd)] outline-none hover:bg-[var(--ac)] focus-visible:bg-[var(--ac)] data-[separator=active]:bg-[var(--ac)]'

/** The store's collapsed flag: read from `host.layout` until the store knows it, written back on change. */
function useTreeCollapsed(): boolean {
  const { layout } = useRendererHost()
  const stored = useGitChangesStore((s) => s.treeCollapsed)
  const collapsed = stored ?? layout.get(TREE_COLLAPSED_LAYOUT_KEY) === COLLAPSED
  useLayoutEffect(() => {
    if (stored === null) useGitChangesStore.getState().setTreeCollapsed(collapsed)
    else layout.set(TREE_COLLAPSED_LAYOUT_KEY, stored ? COLLAPSED : EXPANDED)
  }, [layout, stored, collapsed])
  return collapsed
}

/** Collapses or expands the panel when the store says so (dragging it closed updates the store, see `onResize`). */
function useSyncPanel(ref: React.RefObject<PanelImperativeHandle | null>, collapsed: boolean): void {
  useEffect(() => {
    const panel = ref.current
    if (panel === null || panel.isCollapsed() === collapsed) return
    const apply = collapsed ? panel.collapse : panel.expand
    apply.call(panel)
  }, [ref, collapsed])
}

/**
 * Left pane (the file list, 232px by default, 140–480px) and right pane with a draggable separator. The list
 * collapses fully: dragged below its minimum, by the toolbar toggle / `gitChanges.toggleFileList`, or by
 * double-clicking the separator. Sizes and the collapsed state persist in `host.layout`.
 */
export function SplitPane({ left, right }: { left: ReactNode; right: ReactNode }) {
  const t = useT()
  const host = useRendererHost()
  const treeRef = usePanelRef()
  const collapsed = useTreeCollapsed()
  useSyncPanel(treeRef, collapsed)
  const layout = useDefaultLayout({
    id: SPLIT_LAYOUT_ID,
    storage: host.layout.storage,
    onlySaveAfterUserInteractions: true,
  })
  // Dragging below the minimum collapses too; read the panel's own state (a hidden tab measures 0px, not collapsed).
  const onTreeResize = () => {
    const panel = treeRef.current
    if (panel) useGitChangesStore.getState().setTreeCollapsed(panel.isCollapsed())
  }
  return (
    <Group
      id={SPLIT_LAYOUT_ID}
      orientation={ORIENTATION}
      className="min-h-0 flex-1"
      defaultLayout={layout.defaultLayout}
      onLayoutChanged={layout.onLayoutChanged}
    >
      <Panel
        id={PANE.tree}
        panelRef={treeRef}
        data-testid={T.treePane}
        data-collapsed={collapsed}
        defaultSize={px(collapsed ? TREE_COLLAPSED_PX : TREE_WIDTH_PX)}
        minSize={px(TREE_MIN_WIDTH_PX)}
        maxSize={px(TREE_MAX_WIDTH_PX)}
        collapsible
        collapsedSize={px(TREE_COLLAPSED_PX)}
        onResize={onTreeResize}
      >
        <div className="h-full min-h-0 py-1">{left}</div>
      </Panel>
      <Separator
        data-testid={T.treeSeparator}
        aria-label={t('git-changes:tree.resize')}
        className={SEPARATOR_CLASS}
        disableDoubleClick
        onDoubleClick={() => useGitChangesStore.getState().toggleTree()}
      />
      <Panel id={PANE.diff} minSize={px(DIFF_MIN_WIDTH_PX)}>
        <div className="flex h-full min-h-0 min-w-0 flex-col">{right}</div>
      </Panel>
    </Group>
  )
}
