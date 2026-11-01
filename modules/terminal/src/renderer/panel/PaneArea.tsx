import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { MAX_PANES_PER_TAB, SPLIT, type TerminalPane, type TerminalTab, TerminalTestIds } from '../../contract'
import { StatusBanner } from '../view/StatusBanner'
import { TerminalView } from '../view/TerminalView'
import { closePane } from './actions'
import { ControlButton } from './ControlButton'

const SEPARATOR_CLASS = 'bg-bd outline-none hover:bg-ac data-[separator=active]:bg-ac'
const SEPARATOR_SIZE = { [SPLIT.vertical]: 'w-px', [SPLIT.horizontal]: 'h-px' } as const
/** `vertical` split = side by side (a horizontal group), `horizontal` = stacked. */
const GROUP_ORIENTATION = { [SPLIT.vertical]: 'horizontal', [SPLIT.horizontal]: 'vertical' } as const

function PaneView({ tab, pane, searchRequest }: { tab: TerminalTab; pane: TerminalPane; searchRequest: number }) {
  const t = useT()
  const active = pane.id === tab.activePaneId
  return (
    <div className="relative h-full min-h-0">
      {pane.error ? (
        <StatusBanner text={t('terminal:status.error', { message: pane.error })} />
      ) : (
        <TerminalView ptyId={pane.ptyId} autoFocus={active} searchRequest={active ? searchRequest : 0} />
      )}
      {tab.panes.length === MAX_PANES_PER_TAB && (
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

/** One tab's panes: a single view, or two in a resizable group. */
export function PaneArea({ tab, searchRequest }: { tab: TerminalTab; searchRequest: number }) {
  const [first, second] = tab.panes
  if (!first) return null
  if (!second || tab.split === SPLIT.none) return <PaneView tab={tab} pane={first} searchRequest={searchRequest} />
  return (
    <Group orientation={GROUP_ORIENTATION[tab.split]} className="h-full">
      <Panel id={first.id}>
        <PaneView tab={tab} pane={first} searchRequest={searchRequest} />
      </Panel>
      <Separator className={cn(SEPARATOR_CLASS, SEPARATOR_SIZE[tab.split])} />
      <Panel id={second.id}>
        <PaneView tab={tab} pane={second} searchRequest={searchRequest} />
      </Panel>
    </Group>
  )
}
