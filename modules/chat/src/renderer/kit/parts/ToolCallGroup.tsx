import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { type ReactNode, useState } from 'react'
import { BUTTON_TYPE } from '../../../constants'
import { CHAT_TESTIDS, type ToolCallItem } from '../../../contract'
import { CollapsibleCard } from './lib/CollapsibleCard'
import { StatusGlyph } from './lib/StatusGlyph'
import { aggregateToolStatus, toolStatusIcon } from './lib/tool-status-visual'

function ToolRow({ item, render }: { item: ToolCallItem; render(item: ToolCallItem): ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="flex flex-col">
      <button
        type={BUTTON_TYPE}
        data-testid={CHAT_TESTIDS.toolRow}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-7 min-w-0 items-center gap-2 rounded-md px-1.5 text-left text-[12.5px] hover:bg-hv',
          open && 'bg-hv',
        )}
      >
        <span className="shrink-0 font-semibold text-tx">{item.name}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-mu">{item.title ?? ''}</span>
        <StatusGlyph {...toolStatusIcon(item.status)} />
      </button>
      {open ? <div className="py-1.5">{render(item)}</div> : null}
    </li>
  )
}

/** Consecutive tool calls as one card: "N tool calls" + aggregate status; collapsed by default (ui-notes). */
export function ToolCallGroup({ items, render }: { items: ToolCallItem[]; render(item: ToolCallItem): ReactNode }) {
  const t = useT()
  return (
    <CollapsibleCard
      testId={CHAT_TESTIDS.toolGroup}
      toggleTestId={CHAT_TESTIDS.toolGroupToggle}
      header={
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex-1 text-tx">{t('chat:tool.group', { count: items.length })}</span>
          <StatusGlyph {...toolStatusIcon(aggregateToolStatus(items.map((i) => i.status)))} />
        </span>
      }
    >
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <ToolRow key={item.id} item={item} render={render} />
        ))}
      </ul>
    </CollapsibleCard>
  )
}
