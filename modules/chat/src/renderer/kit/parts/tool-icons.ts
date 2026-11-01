import { Bot, FilePen, FilePlus, FileText, Globe, ListTodo, Search, SquareTerminal, Wrench } from '@pragma/ui/icons'
import { type ChatToolKind, TOOL_KIND } from '../../../contract'

/** Header icon per tool kind (lucide, 1.5 stroke). */
export const TOOL_ICONS: Record<ChatToolKind, typeof Bot> = {
  [TOOL_KIND.shell]: SquareTerminal,
  [TOOL_KIND.read]: FileText,
  [TOOL_KIND.search]: Search,
  [TOOL_KIND.edit]: FilePen,
  [TOOL_KIND.write]: FilePlus,
  [TOOL_KIND.web]: Globe,
  [TOOL_KIND.task]: Bot,
  [TOOL_KIND.todo]: ListTodo,
  [TOOL_KIND.other]: Wrench,
}
