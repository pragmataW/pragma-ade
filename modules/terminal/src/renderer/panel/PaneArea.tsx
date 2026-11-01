import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Fragment } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import {
  LAYOUT_NODE,
  type LayoutNode,
  SPLIT,
  type SplitNode,
  type TerminalPane,
  type TerminalTab,
  TerminalTestIds,
} from '../../contract'
import { leafIds } from '../../lib/layout-tree'
import { StatusBanner } from '../view/StatusBanner'
import { TerminalView } from '../view/TerminalView'
import { closePane, focusPane } from './actions'
import { ControlButton } from './ControlButton'

const SEPARATOR_CLASS = 'bg-bd outline-none hover:bg-ac data-[separator=active]:bg-ac'
const SEPARATOR_SIZE = { [SPLIT.vertical]: 'w-px', [SPLIT.horizontal]: 'h-px' } as const
/** `vertical` split = side by side (a horizontal group), `horizontal` = stacked. */
const GROUP_ORIENTATION = { [SPLIT.vertical]: 'horizontal', [SPLIT.horizontal]: 'vertical' } as const
const SPLIT_KEY_PREFIX = 'split:'

/** A stable key: the pane id, or the first pane id of a split (siblings never share panes). */
const nodeKey = (node: LayoutNode): string =>
  node.kind === LAYOUT_NODE.pane ? node.paneId : `${SPLIT_KEY_PREFIX}${leafIds(node)[0]}`

interface AreaProps {
  tab: TerminalTab
  searchRequest: number
}

function PaneView({ tab, pane, searchRequest }: AreaProps & { pane: TerminalPane }) {
  const t = useT()
  const active = pane.id === tab.activePaneId
  const several = tab.panes.length > 1
  const focus = () => {
    if (!active) focusPane(tab.id, pane.id)
  }
  return (
    <div
      data-testid={TerminalTestIds.pane}
      data-active={active}
      onFocusCapture={focus}
      onMouseDownCapture={focus}
      className="relative h-full min-h-0"
    >
      {pane.error ? (
        <StatusBanner text={t('terminal:status.error', { message: pane.error })} />
      ) : (
        <TerminalView ptyId={pane.ptyId} autoFocus={active} searchRequest={active ? searchRequest : 0} />
      )}
      {several && active && <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 bg-ac" />}
      {several && (
        <ControlButton
          icon="x"
          label={t('terminal:pane.close')}
          testId={TerminalTestIds.paneClose}
          onClick={() => closePane(tab.id, pane.id)}
          className="absolute top-0.5 right-1 z-10"
        />
      )}
    </div>
  )
}

function SplitView({ node, ...area }: AreaProps & { node: SplitNode }) {
  return (
    <Group orientation={GROUP_ORIENTATION[node.direction]} className="h-full">
      {node.children.map((child, index) => (
        <Fragment key={nodeKey(child)}>
          {index > 0 && <Separator className={cn(SEPARATOR_CLASS, SEPARATOR_SIZE[node.direction])} />}
          <Panel id={nodeKey(child)}>
            <NodeView node={child} {...area} />
          </Panel>
        </Fragment>
      ))}
    </Group>
  )
}

function NodeView({ node, ...area }: AreaProps & { node: LayoutNode }) {
  if (node.kind === LAYOUT_NODE.split) return <SplitView node={node} {...area} />
  const pane = area.tab.panes.find((p) => p.id === node.paneId)
  return pane ? <PaneView pane={pane} {...area} /> : null
}

/** One tab's panes: its split tree as nested resizable groups (a single pane renders without a group). */
export function PaneArea(area: AreaProps) {
  return <NodeView node={area.tab.root} {...area} />
}
