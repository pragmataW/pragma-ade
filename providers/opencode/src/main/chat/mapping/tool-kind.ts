import { type ChatToolKind, TOOL_KIND } from '@pragma/module-chat/contract'
import { TITLE_KEYS, TOOL_KINDS } from '../constants'

const isKnown = (name: string): name is keyof typeof TOOL_KINDS => Object.hasOwn(TOOL_KINDS, name)

/** The chat tool kind of an OpenCode tool (`other` when unknown). */
export const toolKindOf = (name: string): ChatToolKind => (isKnown(name) ? TOOL_KINDS[name] : TOOL_KIND.other)

/** The tool's target (path, command, pattern, url, …) from its input, if any. */
export function toolTitleOf(_name: string, input: unknown): string | undefined {
  if (!input || typeof input !== 'object') return undefined
  const record = input as Record<string, unknown>
  for (const key of TITLE_KEYS) {
    const v = record[key]
    if (typeof v === 'string' && v) return v
  }
  return undefined
}
