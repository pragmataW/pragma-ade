import { useT } from '@pragma/sdk/renderer'
import { CopyButton } from '@pragma/ui/components/copy-button'
import { Globe, Search } from '@pragma/ui/icons'
import { type ReactNode, useState } from 'react'
import {
  BUTTON_TYPE,
  ELLIPSIS,
  ICON_PX,
  ICON_STROKE,
  JSON_INDENT,
  KV_VALUE_CHARS,
  READ_PREVIEW_LINES,
  SHELL_OUTPUT_MAX_H_PX,
  TASK_PROMPT_FIELD,
  TODO_INPUT_FIELD,
  TODO_STATUS_ALIASES,
  TODO_TEXT_FIELDS,
} from '../../../constants'
import {
  CHAT_TESTIDS,
  type ChatSessionApi,
  type ChatToolKind,
  TODO_STATUS,
  TOOL_KIND,
  TOOL_STATUS,
  type TodoItem,
  type ToolCallItem,
  taskOfToolCall,
} from '../../../contract'
import { useChatHost } from '../../host-adapter'
import { ChildTranscript } from './ChatRows'
import { HunkDiff } from './HunkDiff'
import { inputField as field } from './lib/input-field'
import { MonoPre } from './lib/MonoPre'
import { hunkPreview } from './PermissionCard'
import { TaskCard } from './TaskCard'
import { TodoChecklist } from './TodoList'

type BodyProps = { item: ToolCallItem; session: ChatSessionApi }
type Body = (props: BodyProps) => ReactNode
const LINE_RE = /\r?\n/
const lines = (text: string | undefined): string[] => (text ? text.split(LINE_RE) : [])
const preview = (text: string | undefined): string => lines(text).slice(0, READ_PREVIEW_LINES).join('\n')
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function Output({ item, maxHeight }: { item: ToolCallItem; maxHeight?: number }) {
  const t = useT()
  if (!item.output && !item.error) return null
  const text = item.output ?? item.error ?? ''
  return (
    <div className="relative">
      <div className="absolute top-0 right-0">
        <CopyButton text={text} label={t('chat:copy.label')} copiedLabel={t('chat:copy.copied')} className="size-6" />
      </div>
      <MonoPre maxHeight={maxHeight} className={item.status === TOOL_STATUS.error ? 'text-err' : undefined}>
        {text}
      </MonoPre>
      {item.outputTruncated ? <span className="text-[11px] text-warn">{t('chat:tool.truncated')}</span> : null}
    </div>
  )
}

/** Only failures: a successful edit/web/todo call says it all in its own card. */
const ErrorOutput: Body = ({ item }) =>
  item.status === TOOL_STATUS.error ? <Output item={item} maxHeight={SHELL_OUTPUT_MAX_H_PX} /> : null

const ShellBody: Body = ({ item }) => (
  <div className="flex flex-col gap-2">
    <MonoPre className="text-mu">{`$ ${item.title ?? field(item.input, 'command') ?? ''}`}</MonoPre>
    <Output item={item} maxHeight={SHELL_OUTPUT_MAX_H_PX} />
  </div>
)

function ReadBody({ item }: BodyProps) {
  const text = preview(item.output)
  return (
    <div className="flex flex-col gap-2">
      <MonoPre className="text-mu">{item.title ?? ''}</MonoPre>
      {text ? <MonoPre maxHeight={SHELL_OUTPUT_MAX_H_PX}>{text}</MonoPre> : null}
    </div>
  )
}

function SearchBody({ item }: BodyProps) {
  const t = useT()
  return (
    <div className="flex items-center gap-2 text-[12px] text-mu">
      <span className="font-mono text-tx">{item.title ?? ''}</span>
      {item.output !== undefined ? (
        <span>{t('chat:tool.results', { count: lines(item.output).filter(Boolean).length })}</span>
      ) : null}
    </div>
  )
}

/** Edit/write: the change as a diff (`old_string`/`new_string` or `content`), else the key/value view. */
function EditBody(props: BodyProps) {
  const hunk = hunkPreview(props.item.input)
  if (!hunk) return <KeyValueBody {...props} />
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-md border border-bd">
        <HunkDiff path={hunk.path} hunks={hunk.hunks} />
      </div>
      <ErrorOutput {...props} />
    </div>
  )
}

/** Web fetch / search: a URL card (opens externally) or the query, then the first lines of the result. */
function WebBody(props: BodyProps) {
  const host = useChatHost()
  const { item } = props
  const url = field(item.input, 'url')
  const query = field(item.input, 'query')
  const text = preview(item.output)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-w-0 items-center gap-2 rounded-md border border-bd bg-pn px-2.5 py-1.5 text-[12px]">
        {url ? (
          <>
            <Globe size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="shrink-0 text-mu" />
            <button
              type={BUTTON_TYPE}
              onClick={() => host.openExternal(url)}
              className="min-w-0 truncate font-mono text-act hover:underline"
            >
              {url}
            </button>
          </>
        ) : (
          <>
            <Search size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="shrink-0 text-mu" />
            <span className="min-w-0 truncate text-tx">{query ?? item.title ?? ''}</span>
          </>
        )}
      </div>
      {text && item.status !== TOOL_STATUS.error ? (
        <MonoPre maxHeight={SHELL_OUTPUT_MAX_H_PX} className="text-mu">
          {text}
        </MonoPre>
      ) : null}
      <ErrorOutput {...props} />
    </div>
  )
}

const todoText = (t: Record<string, unknown>): string =>
  TODO_TEXT_FIELDS.map((k) => t[k]).find((v): v is string => typeof v === 'string') ?? ''

/** `{ todos: [{ content, status }] }` (TodoWrite-like inputs) as todo items. */
export function todosOf(input: unknown): TodoItem[] {
  const list = isRecord(input) ? input[TODO_INPUT_FIELD] : undefined
  if (!Array.isArray(list)) return []
  return list.filter(isRecord).map((t, i) => ({
    id: typeof t.id === 'string' ? t.id : String(i),
    text: todoText(t),
    status: TODO_STATUS_ALIASES[String(t.status)] ?? TODO_STATUS.pending,
  }))
}

function TodoBody(props: BodyProps) {
  const todos = todosOf(props.item.input)
  if (todos.length === 0) return <KeyValueBody {...props} />
  return (
    <div className="flex flex-col gap-2">
      <TodoChecklist items={todos} />
      <ErrorOutput {...props} />
    </div>
  )
}

/** A subagent call: its task card when the provider reported one, else the prompt and the nested transcript. */
function TaskBody({ item, session }: BodyProps) {
  const task = taskOfToolCall(session.transcript, item.id)
  if (task) return <TaskCard item={task} session={session} />
  const prompt = field(item.input, TASK_PROMPT_FIELD)
  return (
    <div className="flex flex-col gap-2">
      {prompt ? <div className="whitespace-pre-wrap text-[12.5px] leading-[1.5] text-mu">{prompt}</div> : null}
      <div className="border-l-2 border-bd pl-3">
        <ChildTranscript parentIds={[item.id]} session={session} testId={CHAT_TESTIDS.taskChildren} />
      </div>
      <Output item={item} maxHeight={SHELL_OUTPUT_MAX_H_PX} />
    </div>
  )
}

const cut = (s: string): string => (s.length > KV_VALUE_CHARS ? `${s.slice(0, KV_VALUE_CHARS)}${ELLIPSIS}` : s)
const primitive = (v: unknown): string | undefined =>
  typeof v === 'string' ? cut(v) : typeof v === 'number' || typeof v === 'boolean' ? String(v) : undefined

/** Any other tool: its primitive input fields as key/value rows; the full input JSON on demand; the output. */
function KeyValueBody({ item }: BodyProps) {
  const t = useT()
  const [json, setJson] = useState(false)
  const rows = isRecord(item.input)
    ? Object.entries(item.input).flatMap(([k, v]) => {
        const text = primitive(v)
        return text === undefined ? [] : [[k, text] as const]
      })
    : []
  return (
    <div className="flex flex-col gap-2">
      {rows.length > 0 ? (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-[12px]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-mono text-mu">{k}</dt>
              <dd className="min-w-0 break-words font-mono text-tx">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <button
        type={BUTTON_TYPE}
        aria-expanded={json}
        data-testid={CHAT_TESTIDS.toolJson}
        onClick={() => setJson((o) => !o)}
        className="w-fit text-[11.5px] text-mu hover:text-tx"
      >
        {t(json ? 'chat:tool.hideInput' : 'chat:tool.showInput')}
      </button>
      {json ? (
        <MonoPre maxHeight={SHELL_OUTPUT_MAX_H_PX} className="text-mu">
          {JSON.stringify(item.input ?? {}, null, JSON_INDENT)}
        </MonoPre>
      ) : null}
      <Output item={item} maxHeight={SHELL_OUTPUT_MAX_H_PX} />
    </div>
  )
}

/** Body by tool kind (diffs for edits, URL cards for web, checklists for todos, task cards, key/value otherwise). */
export const TOOL_BODIES: Record<ChatToolKind, Body> = {
  [TOOL_KIND.shell]: ShellBody,
  [TOOL_KIND.read]: ReadBody,
  [TOOL_KIND.search]: SearchBody,
  [TOOL_KIND.edit]: EditBody,
  [TOOL_KIND.write]: EditBody,
  [TOOL_KIND.web]: WebBody,
  [TOOL_KIND.task]: TaskBody,
  [TOOL_KIND.todo]: TodoBody,
  [TOOL_KIND.other]: KeyValueBody,
}
