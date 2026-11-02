import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { ArrowDown } from '@pragma/ui/icons'
import { useVirtualizer } from '@tanstack/react-virtual'
import { type ComponentType, type ReactNode, type Ref, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import {
  ALIGN_CENTER,
  ALIGN_END,
  CHAT_ROW_ATTR,
  ICON_PX,
  ICON_STROKE,
  INITIAL_RECT,
  LIST_OVERSCAN,
  ROW_ESTIMATE_PX,
  SIZE_SM,
  VARIANT_OUTLINE,
} from '../../../constants'
import {
  CHAT_TESTIDS,
  type ChatItem,
  type ChatPartComponent,
  type ChatPartKey,
  type ChatPartProps,
  type ChatSessionApi,
  type ChatTurnHeaderProps,
  EVENT_KIND,
  type ToolCallItem,
} from '../../../contract'
import { useStickToBottom } from './lib/useStickToBottom'
import { buildRows, type ChatRow, partKeyOf, ROW_KIND } from './rows'
import { ToolCallGroup } from './ToolCallGroup'

export interface MessageListProps {
  items: readonly ChatItem[]
  parts: Partial<Record<ChatPartKey, ChatPartComponent>>
  groupToolCalls?: boolean
  turnHeader?: ComponentType<ChatTurnHeaderProps> | null
  session: ChatSessionApi
  /** 11c: imperative access for in-chat search (row indexes are `buildRows` indexes). */
  handle?: Ref<MessageListHandle>
}

export interface MessageListHandle {
  scrollToIndex(index: number): void
  /** The rendered element of a row, when it is in the virtual window. */
  rowElement(index: number): HTMLElement | null
}

type AnyPart = ComponentType<ChatPartProps>

function Row({ row, props }: { row: ChatRow; props: MessageListProps }) {
  const part = (item: ChatItem): ReactNode => {
    const Part = props.parts[partKeyOf(item)] as AnyPart | undefined
    return Part ? <Part item={item} session={props.session} /> : null
  }
  if (row.kind === ROW_KIND.group)
    return <ToolCallGroup items={row.items} render={(item: ToolCallItem) => part(item)} />
  if (row.kind === ROW_KIND.turnHeader) {
    const Header = props.turnHeader
    return Header ? <Header session={props.session} at={row.at} /> : null
  }
  return part(row.item)
}

/** The virtualized transcript (centred 740 px column); sticks to the bottom, "Jump to latest" when scrolled up. */
export function MessageList(props: MessageListProps) {
  const t = useT()
  const { items, parts, groupToolCalls = true, turnHeader } = props
  const rows = useMemo(
    () => buildRows(items, parts, { groupToolCalls, turnHeader: Boolean(turnHeader) }),
    [items, parts, groupToolCalls, turnHeader],
  )
  const scroller = useRef<HTMLDivElement>(null)
  const { atBottom, onScroll } = useStickToBottom(scroller)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_ESTIMATE_PX,
    overscan: LIST_OVERSCAN,
    getItemKey: (i) => rows[i]?.key ?? i,
    initialRect: INITIAL_RECT,
  })
  useImperativeHandle(
    props.handle,
    () => ({
      scrollToIndex: (index) => virtualizer.scrollToIndex(index, { align: ALIGN_CENTER }),
      rowElement: (index) => scroller.current?.querySelector<HTMLElement>(`[${CHAT_ROW_ATTR}="${index}"]`) ?? null,
    }),
    [virtualizer],
  )
  const lastIndex = rows.length - 1
  const last = items.at(-1)
  /** Changes whenever the tail grows (new row or streamed text), so a pinned list follows it. */
  const tail = `${rows.at(-1)?.key}:${last?.kind === EVENT_KIND.textDelta ? last.text.length : 0}`
  useEffect(() => {
    if (atBottom && lastIndex >= 0 && tail) virtualizer.scrollToIndex(lastIndex, { align: ALIGN_END })
  }, [tail, atBottom, lastIndex, virtualizer])
  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scroller} onScroll={onScroll} data-testid={CHAT_TESTIDS.messageList} className="h-full overflow-y-auto">
        <div className="relative mx-auto w-full max-w-[740px]" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((v) => {
            const row = rows[v.index]
            if (!row) return null
            return (
              <div
                key={v.key}
                data-index={v.index}
                {...{ [CHAT_ROW_ATTR]: v.index }}
                ref={virtualizer.measureElement}
                className="absolute top-0 left-0 w-full px-4 py-1.5"
                style={{ transform: `translateY(${v.start}px)` }}
              >
                <Row row={row} props={props} />
              </div>
            )
          })}
        </div>
      </div>
      {atBottom ? null : (
        <Button
          size={SIZE_SM}
          variant={VARIANT_OUTLINE}
          data-testid={CHAT_TESTIDS.jumpToLatest}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 gap-1 bg-el"
          onClick={() => virtualizer.scrollToIndex(rows.length - 1, { align: ALIGN_END })}
        >
          <ArrowDown size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden />
          {t('chat:list.jumpToLatest')}
        </Button>
      )}
    </div>
  )
}
