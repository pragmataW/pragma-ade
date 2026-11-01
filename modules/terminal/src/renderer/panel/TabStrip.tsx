import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Icon } from '@pragma/ui/components/icon'
import { type KeyboardEvent, useState } from 'react'
import { TAB_ICON_PX } from '../../constants'
import {
  MAX_PANES_PER_TAB,
  SPLIT,
  type TerminalTab,
  TerminalTestIds,
  type WorktreeTerminalLayout,
} from '../../contract'
import { activateTab, closeTab, newTab, renameTab, splitTab } from './actions'
import { ControlButton } from './ControlButton'
import { tabLabel, tabStatus } from './labels'

const ENTER = 'Enter'
const ESCAPE = 'Escape'
function RenameInput({ tab, onDone }: { tab: TerminalTab; onDone(): void }) {
  const t = useT()
  const [value, setValue] = useState(tab.customTitle ?? '')
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ENTER) {
      renameTab(tab.id, value)
      onDone()
    }
    if (e.key === ESCAPE) onDone()
  }
  return (
    <input
      data-testid={TerminalTestIds.tabRename}
      aria-label={t('terminal:tab.renameLabel')}
      // biome-ignore lint/a11y/noAutofocus: the input appears on an explicit double-click
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={onDone}
      className="h-6 w-28 rounded-[var(--radius-chip)] border border-bd2 bg-el px-1.5 text-[12px] text-tx outline-none"
    />
  )
}

function TabButton({ tab, active }: { tab: TerminalTab; active: boolean }) {
  const t = useT()
  const [editing, setEditing] = useState(false)
  const status = tabStatus(tab, t)
  return (
    <div
      role="tab"
      tabIndex={0}
      aria-selected={active}
      data-testid={TerminalTestIds.tab(tab.id)}
      onClick={() => activateTab(tab.id)}
      onKeyDown={(e) => e.key === ENTER && activateTab(tab.id)}
      onDoubleClick={() => setEditing(true)}
      className={cn(
        'group flex h-full shrink-0 cursor-default items-center gap-1.5 border-b-2 pr-1 pl-3 text-[12px]',
        active ? 'border-ac text-tx' : 'border-transparent text-mu hover:text-tx',
      )}
    >
      <Icon name="square-terminal" size={TAB_ICON_PX} />
      {editing ? <RenameInput tab={tab} onDone={() => setEditing(false)} /> : <span>{tabLabel(tab, t)}</span>}
      {status && (
        <span data-testid={TerminalTestIds.tabStatus} title={status} className="max-w-40 truncate text-[11px] text-fa">
          {status}
        </span>
      )}
      <ControlButton
        icon="x"
        label={t('terminal:tab.close')}
        onClick={() => closeTab(tab.id)}
        className="opacity-60 group-hover:opacity-100"
      />
    </div>
  )
}

/** Split side by side / stacked; both are disabled once the active tab holds `MAX_PANES_PER_TAB` panes. */
function SplitButtons({ paneCount }: { paneCount: number }) {
  const t = useT()
  const full = paneCount >= MAX_PANES_PER_TAB
  const limit = t('terminal:actions.splitLimit', { max: MAX_PANES_PER_TAB })
  const buttons = [
    { direction: SPLIT.vertical, icon: 'columns-2', label: 'terminal:actions.splitVertical' },
    { direction: SPLIT.horizontal, icon: 'rows-2', label: 'terminal:actions.splitHorizontal' },
  ] as const
  const testIds = {
    [SPLIT.vertical]: TerminalTestIds.splitVertical,
    [SPLIT.horizontal]: TerminalTestIds.splitHorizontal,
  }
  return buttons.map((b) => (
    <ControlButton
      key={b.direction}
      icon={b.icon}
      label={full ? limit : t(b.label)}
      testId={testIds[b.direction]}
      disabled={full}
      onClick={() => splitTab(b.direction)}
    />
  ))
}

/** Tabs of the active worktree plus New / Split actions. */
export function TabStrip({ layout }: { layout: WorktreeTerminalLayout }) {
  const t = useT()
  const activeTab = layout.tabs.find((tab) => tab.id === layout.activeTabId)
  return (
    <div className="flex h-8 shrink-0 items-stretch border-b border-bd bg-pn">
      <div role="tablist" className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
        {layout.tabs.map((tab) => (
          <TabButton key={tab.id} tab={tab} active={tab.id === layout.activeTabId} />
        ))}
      </div>
      <div className="flex items-center gap-0.5 px-1">
        <ControlButton
          icon="plus"
          label={t('terminal:actions.newTab')}
          testId={TerminalTestIds.newTab}
          onClick={newTab}
        />
        <SplitButtons paneCount={activeTab?.panes.length ?? 0} />
      </div>
    </div>
  )
}
