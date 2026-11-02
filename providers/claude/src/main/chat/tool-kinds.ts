import type { ChatEventOf, ChatToolKind, TodoItem } from '@pragma/module-chat/contract'
import { FILE_CHANGE, EVENT_KIND as K, TODO_STATUS, TOOL_KIND } from '@pragma/module-chat/contract'
import { CLAUDE_TOOLS as T } from './constants'

const KINDS: Record<string, ChatToolKind> = {
  [T.bash]: TOOL_KIND.shell,
  [T.bashOutput]: TOOL_KIND.shell,
  [T.killShell]: TOOL_KIND.shell,
  [T.read]: TOOL_KIND.read,
  [T.notebookRead]: TOOL_KIND.read,
  [T.grep]: TOOL_KIND.search,
  [T.glob]: TOOL_KIND.search,
  [T.ls]: TOOL_KIND.search,
  [T.edit]: TOOL_KIND.edit,
  [T.multiEdit]: TOOL_KIND.edit,
  [T.notebookEdit]: TOOL_KIND.edit,
  [T.write]: TOOL_KIND.write,
  [T.webFetch]: TOOL_KIND.web,
  [T.webSearch]: TOOL_KIND.web,
  [T.task]: TOOL_KIND.task,
  [T.agent]: TOOL_KIND.task,
  [T.workflow]: TOOL_KIND.task,
  [T.todoWrite]: TOOL_KIND.todo,
}

export const toolKindFor = (name: string): ChatToolKind => KINDS[name] ?? TOOL_KIND.other

/** The input field that names what a tool works on. */
const TITLE_FIELDS: Record<string, string> = {
  [T.bash]: 'command',
  [T.read]: 'file_path',
  [T.edit]: 'file_path',
  [T.write]: 'file_path',
  [T.multiEdit]: 'file_path',
  [T.notebookEdit]: 'notebook_path',
  [T.grep]: 'pattern',
  [T.glob]: 'pattern',
  [T.webFetch]: 'url',
  [T.webSearch]: 'query',
  [T.task]: 'description',
  [T.agent]: 'description',
}

type Input = Record<string, unknown>
const asInput = (input: unknown): Input => (input && typeof input === 'object' ? (input as Input) : {})
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

export function toolTitleFor(name: string, input: unknown): string | undefined {
  const field = TITLE_FIELDS[name]
  return field ? str(asInput(input)[field]) : undefined
}

type FileEdit = ChatEventOf<typeof K.fileEdit>
const hunk = (e: Input) => ({ before: str(e.old_string) ?? '', after: str(e.new_string) ?? '' })

/** The inline diff of an edit/write tool call (`toolCallId` is set by the caller). */
export function fileEditFor(name: string, input: unknown, toolUseResult?: unknown): FileEdit | undefined {
  const i = asInput(input)
  const path = str(i.file_path)
  if (!path) return undefined
  if (name === T.edit) return { kind: K.fileEdit, path, change: FILE_CHANGE.edit, hunks: [hunk(i)] }
  if (name === T.multiEdit) {
    const edits = Array.isArray(i.edits) ? i.edits.map((e) => hunk(asInput(e))) : []
    return { kind: K.fileEdit, path, change: FILE_CHANGE.edit, hunks: edits }
  }
  if (name !== T.write) return undefined
  const original = str(asInput(toolUseResult).originalFile)
  return {
    kind: K.fileEdit,
    path,
    change: original ? FILE_CHANGE.overwrite : FILE_CHANGE.create,
    hunks: [{ before: original ?? '', after: str(i.content) ?? '' }],
  }
}

const TODO_STATUS_MAP: Record<string, TodoItem['status']> = {
  pending: TODO_STATUS.pending,
  in_progress: TODO_STATUS.active,
  completed: TODO_STATUS.done,
}

/** `TodoWrite` input → todo items (id = index). */
export function todoFor(input: unknown): TodoItem[] {
  const todos = asInput(input).todos
  if (!Array.isArray(todos)) return []
  return todos.map((t, index) => {
    const todo = asInput(t)
    return {
      id: String(index),
      text: str(todo.content) ?? '',
      status: TODO_STATUS_MAP[str(todo.status) ?? ''] ?? TODO_STATUS.pending,
    }
  })
}
