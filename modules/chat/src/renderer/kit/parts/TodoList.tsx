import { SESSION_STATUS } from '@pragma/module-agents/contract'
import { cn } from '@pragma/ui'
import { Check, Square } from '@pragma/ui/icons'
import { ICON_PX, ICON_STROKE } from '../../../constants'
import {
  CHAT_DATA_ATTRS,
  CHAT_TESTIDS,
  type ChatPartProps,
  EVENT_KIND,
  TODO_STATUS,
  type TodoItem,
  type TodoListItem,
} from '../../../contract'
import { StatusGlyph } from './lib/StatusGlyph'

function Mark({ status }: { status: TodoItem['status'] }) {
  if (status === TODO_STATUS.done)
    return <Check size={ICON_PX} strokeWidth={ICON_STROKE} className="shrink-0 text-ok" />
  if (status === TODO_STATUS.active) return <StatusGlyph status={SESSION_STATUS.working} turnCompleted={false} />
  return <Square size={ICON_PX} strokeWidth={ICON_STROKE} className="shrink-0 text-fa" />
}

/** Plan card: done = ok check + strikethrough, active = info ring, pending = empty box. */
export function TodoList({ item }: ChatPartProps<TodoListItem>) {
  return (
    <ul
      data-testid={CHAT_TESTIDS.part(EVENT_KIND.todo)}
      className="flex flex-col gap-1 rounded-lg border border-bd bg-el px-3 py-2"
    >
      {item.items.map((todo) => (
        <li
          key={todo.id}
          {...{ [CHAT_DATA_ATTRS.status]: todo.status }}
          className="flex items-center gap-2 text-[12.5px]"
        >
          <Mark status={todo.status} />
          <span className={cn(todo.status === TODO_STATUS.done ? 'text-mu line-through' : 'text-tx')}>{todo.text}</span>
        </li>
      ))}
    </ul>
  )
}
