import { type ComponentType, createContext, useContext } from 'react'
import {
  type ChatItem,
  type ChatPartComponent,
  type ChatPartKey,
  type ChatPartProps,
  type ChatSessionApi,
  type ChatTurnHeaderProps,
  childItems,
  type ToolCallItem,
} from '../../../contract'
import { buildRows, type ChatRow, partKeyOf, ROW_KIND } from './rows'
import { ToolCallGroup } from './ToolCallGroup'

type Parts = Partial<Record<ChatPartKey, ChatPartComponent>>
type AnyPart = ComponentType<ChatPartProps>

const ChatPartsContext = createContext<{ parts: Parts; groupToolCalls: boolean }>({ parts: {}, groupToolCalls: true })

/** The provider's parts for nested transcripts (task cards); `MessageList` provides it. */
export const ChatPartsProvider = ChatPartsContext.Provider
export const useChatParts = () => useContext(ChatPartsContext)

/** One item through the provider's part for its kind (nothing when the provider has none). */
export function ChatPart({ item, session }: { item: ChatItem; session: ChatSessionApi }) {
  const Part = useChatParts().parts[partKeyOf(item)] as AnyPart | undefined
  return Part ? <Part item={item} session={session} /> : null
}

/** One message-list row: an item, a tool-call group or a turn header. */
export function ChatRowView({
  row,
  session,
  turnHeader,
}: {
  row: ChatRow
  session: ChatSessionApi
  turnHeader?: ComponentType<ChatTurnHeaderProps> | null
}) {
  if (row.kind === ROW_KIND.group)
    return (
      <ToolCallGroup items={row.items} render={(item: ToolCallItem) => <ChatPart item={item} session={session} />} />
    )
  if (row.kind === ROW_KIND.turnHeader) {
    const Header = turnHeader
    return Header ? <Header session={session} at={row.at} /> : null
  }
  return <ChatPart item={row.item} session={session} />
}

/** The transcript nested under `parentIds` (a subagent's output), rendered with the provider's parts. */
export function ChildTranscript({
  parentIds,
  session,
  testId,
}: {
  parentIds: readonly (string | undefined)[]
  session: ChatSessionApi
  testId?: string
}) {
  const { parts, groupToolCalls } = useChatParts()
  const rows = buildRows(childItems(session.transcript, parentIds), parts, { groupToolCalls, turnHeader: false })
  if (rows.length === 0) return null
  return (
    <div data-testid={testId} className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <ChatRowView key={row.key} row={row} session={session} />
      ))}
    </div>
  )
}
