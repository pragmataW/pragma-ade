import { basename, isAbsolute, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  type ChatPermissionOptionId,
  type ChatPermissionOutcome,
  type ChatUserInput,
  PERMISSION_OPTION,
  PERMISSION_OUTCOME,
} from '@pragma/module-chat/contract'
import { DATA_URI, INLINE_SOURCE, MENTION_RE, MENTION_SIGIL, type PERMISSION_DECISIONS, SLASH_RE } from '../constants'

type Decision = (typeof PERMISSION_DECISIONS)[number]

export interface PromptFile {
  uri: string
  name: string
  source?: typeof INLINE_SOURCE
  mention?: { start: number; end: number; text: string }
}
export interface Prompt {
  text: string
  files?: PromptFile[]
}

/** `@<path>` tokens that name an existing file (relative to the worktree) become file attachments with their range. */
function mentionFiles(text: string, worktreePath: string, exists: (abs: string) => boolean): PromptFile[] {
  return [...text.matchAll(MENTION_RE)].flatMap((m) => {
    const [, lead = '', path = ''] = m
    const abs = isAbsolute(path) ? path : join(worktreePath, path)
    if (!exists(abs)) return []
    const start = (m.index ?? 0) + lead.length
    const token = `${MENTION_SIGIL}${path}`
    return [
      { uri: pathToFileURL(abs).href, name: basename(abs), mention: { start, end: start + token.length, text: token } },
    ]
  })
}

/**
 * The 2.x prompt body: images and documents (PDF, text) inline as data URIs, `@` mentions as `file://` attachments;
 * `files` omitted when empty.
 */
export function toPrompt(input: ChatUserInput, worktreePath: string, exists: (abs: string) => boolean): Prompt {
  const inline = [...input.images, ...(input.files ?? [])].map((i) => ({
    uri: DATA_URI(i.mediaType, i.dataBase64),
    source: INLINE_SOURCE,
    name: i.name,
  }))
  const files = [...inline, ...mentionFiles(input.text, worktreePath, exists)]
  return files.length ? { text: input.text, files } : { text: input.text }
}

/** A leading `/<known command> [text]`, else null. */
export function parseSlash(text: string, names: readonly string[]): { name: string; text: string } | null {
  const groups = SLASH_RE.exec(text.trim())?.groups
  const name = groups?.name
  if (!name || !names.includes(name)) return null
  return { name, text: groups.rest ?? '' }
}

const DECISIONS: Record<ChatPermissionOptionId, Decision> = {
  [PERMISSION_OPTION.allow_once]: 'once',
  [PERMISSION_OPTION.allow_always]: 'always',
  [PERMISSION_OPTION.deny]: 'reject',
}
const OUTCOMES: Record<Decision, ChatPermissionOutcome> = {
  once: PERMISSION_OUTCOME.allowed,
  always: PERMISSION_OUTCOME.allowed_always,
  reject: PERMISSION_OUTCOME.denied,
}

export const toDecision = (id: ChatPermissionOptionId): Decision => DECISIONS[id]
export const outcomeOf = (reply: Decision): ChatPermissionOutcome => OUTCOMES[reply]

/** "Always" only when OpenCode offers patterns to save. */
export const permissionOptions = (save?: readonly string[]): ChatPermissionOptionId[] =>
  save?.length
    ? [PERMISSION_OPTION.allow_once, PERMISSION_OPTION.allow_always, PERMISSION_OPTION.deny]
    : [PERMISSION_OPTION.allow_once, PERMISSION_OPTION.deny]
