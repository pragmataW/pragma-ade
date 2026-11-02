import { cn } from '@pragma/ui'
import { useEffect } from 'react'
import { BUTTON_TYPE } from '../../../constants'
import { CHAT_TESTIDS, type ComposerMenuProps } from '../../../contract'

export interface MenuItem {
  key: string
  label: string
  hint?: string
  insert: string
}

/** The shared trigger-menu body: a list with an active row; Enter/Tab (via `pickRequest`) or a click picks. */
export function MenuList({ items, props }: { items: MenuItem[]; props: ComposerMenuProps }) {
  const { activeIndex, setCount, onPick, pickRequest } = props
  useEffect(() => setCount(items.length), [items.length, setCount])
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new pick request (not item changes) picks
  useEffect(() => {
    const item = items[activeIndex]
    if (pickRequest > 0 && item) onPick(item.insert)
  }, [pickRequest])
  if (items.length === 0) return null
  return (
    <ul data-testid={CHAT_TESTIDS.composerMenu} className="max-h-60 overflow-y-auto py-1">
      {items.map((item, i) => (
        <li key={item.key}>
          <button
            type={BUTTON_TYPE}
            data-testid={CHAT_TESTIDS.composerMenuItem}
            data-active={i === activeIndex}
            onMouseDown={(e) => {
              e.preventDefault()
              onPick(item.insert)
            }}
            className={cn(
              'flex w-full items-baseline gap-2 px-2.5 py-1 text-left text-[12.5px]',
              i === activeIndex ? 'bg-hv' : 'hover:bg-hv',
            )}
          >
            <span className="font-mono text-tx">{item.label}</span>
            {item.hint ? <span className="truncate text-[11.5px] text-mu">{item.hint}</span> : null}
          </button>
        </li>
      ))}
    </ul>
  )
}
