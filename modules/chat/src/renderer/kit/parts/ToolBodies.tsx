import { useT } from '@pragma/sdk/renderer'
import { CopyButton } from '@pragma/ui/components/copy-button'
import type { ReactNode } from 'react'
import { JSON_INDENT, READ_PREVIEW_LINES, SHELL_OUTPUT_MAX_H_PX } from '../../../constants'
import { type ChatToolKind, TOOL_KIND, TOOL_STATUS, type ToolCallItem } from '../../../contract'
import { inputField as field } from './lib/input-field'
import { MonoPre } from './lib/MonoPre'

type Body = (props: { item: ToolCallItem }) => ReactNode
const LINE_RE = /\r?\n/
const lines = (text: string | undefined): string[] => (text ? text.split(LINE_RE) : [])

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

const ShellBody: Body = ({ item }) => (
  <div className="flex flex-col gap-2">
    <MonoPre className="text-mu">{`$ ${item.title ?? field(item.input, 'command') ?? ''}`}</MonoPre>
    <Output item={item} maxHeight={SHELL_OUTPUT_MAX_H_PX} />
  </div>
)

function ReadBody({ item }: { item: ToolCallItem }) {
  const preview = lines(item.output).slice(0, READ_PREVIEW_LINES).join('\n')
  return (
    <div className="flex flex-col gap-2">
      <MonoPre className="text-mu">{item.title ?? ''}</MonoPre>
      {preview ? <MonoPre maxHeight={SHELL_OUTPUT_MAX_H_PX}>{preview}</MonoPre> : null}
    </div>
  )
}

function SearchBody({ item }: { item: ToolCallItem }) {
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

const JsonBody: Body = ({ item }) => (
  <div className="flex flex-col gap-2">
    <MonoPre maxHeight={SHELL_OUTPUT_MAX_H_PX} className="text-mu">
      {JSON.stringify(item.input ?? {}, null, JSON_INDENT)}
    </MonoPre>
    <Output item={item} maxHeight={SHELL_OUTPUT_MAX_H_PX} />
  </div>
)

/** Body by tool kind (shell: command + output; read: first lines; search: pattern + count; else JSON + output). */
export const TOOL_BODIES: Record<ChatToolKind, Body> = {
  [TOOL_KIND.shell]: ShellBody,
  [TOOL_KIND.read]: ReadBody,
  [TOOL_KIND.search]: SearchBody,
  [TOOL_KIND.edit]: JsonBody,
  [TOOL_KIND.write]: JsonBody,
  [TOOL_KIND.web]: JsonBody,
  [TOOL_KIND.task]: JsonBody,
  [TOOL_KIND.todo]: JsonBody,
  [TOOL_KIND.other]: JsonBody,
}
