import { isAbsolute, join } from 'node:path'
import { AGENT_ENV } from '@pragma/module-agents/contract'
import {
  CLI_METHOD,
  type CliCallerContext,
  type CliMethod,
  MAX_DOCUMENT_BYTES,
} from '@pragma/module-cli-integration/contract'
import { type CallCommand, type OptionValue, UsageError } from './args'
import { STDIN_PATH } from './constants'

export interface RequestIo {
  env: NodeJS.ProcessEnv
  cwd: string
  readFile(p: string): Promise<string>
  readStdin(): Promise<string>
}

/** Flags whose payload field has another name; the rest keep their name. */
const RENAMED: Record<string, string> = {
  base: 'baseBranch',
  worktree: 'worktreeId',
  project: 'projectId',
  task: 'taskId',
  'same-worktree': 'sameWorktree',
  timeout: 'timeoutSeconds',
}
/** Flags that name a file whose contents become the field (`-` = stdin). */
const FILE_FIELDS: Record<string, string> = {
  'prompt-file': 'prompt',
  'description-file': 'description',
  file: 'document',
}
/** Methods whose positional `<id>` is a task reference. */
const TASK_REF_METHODS = new Set<CliMethod>([CLI_METHOD.taskUpdate, CLI_METHOD.taskMove])
const TASK_REF_FIELD = 'taskId'
/** Methods whose positional `<id>` is a session id (Pragma or provider). */
const SESSION_REF_METHODS = new Set<CliMethod>([CLI_METHOD.sessionLocate])
const SESSION_REF_FIELD = 'sessionId'
const SAME_WORKTREE_FIELD = 'sameWorktree'
const STDIN_LABEL = 'stdin'

const byteLength = (s: string): number => Buffer.byteLength(s)

async function readDocument(path: string, io: RequestIo): Promise<string> {
  const stdin = path === STDIN_PATH
  const label = stdin ? STDIN_LABEL : isAbsolute(path) ? path : join(io.cwd, path)
  let text: string
  try {
    text = stdin ? await io.readStdin() : await io.readFile(label)
  } catch (e) {
    throw new UsageError(`Cannot read ${label}: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (text.trim().length === 0) throw new UsageError(`${label} is empty.`)
  if (byteLength(text) > MAX_DOCUMENT_BYTES)
    throw new UsageError(`${label} is larger than ${MAX_DOCUMENT_BYTES} bytes.`)
  return text
}

const envValue = (env: NodeJS.ProcessEnv, key: string): string | undefined => env[key] || undefined

function callerContext(io: RequestIo): CliCallerContext {
  const context: CliCallerContext = { cwd: io.cwd }
  const worktreeId = envValue(io.env, AGENT_ENV.worktreeId)
  const sessionId = envValue(io.env, AGENT_ENV.sessionId)
  if (worktreeId) context.worktreeId = worktreeId
  if (sessionId) context.sessionId = sessionId
  return context
}

async function optionField(name: string, value: OptionValue, io: RequestIo): Promise<[string, unknown]> {
  const fileField = FILE_FIELDS[name]
  if (fileField) return [fileField, await readDocument(String(value), io)]
  return [RENAMED[name] ?? name, value]
}

/** A parsed command → bridge method + payload (files read, caller context attached). */
export async function buildRequest(cmd: CallCommand, io: RequestIo): Promise<{ method: CliMethod; payload: unknown }> {
  const payload: Record<string, unknown> = { context: callerContext(io) }
  for (const [name, value] of Object.entries(cmd.options)) {
    const [field, fieldValue] = await optionField(name, value, io)
    payload[field] = fieldValue
  }
  if (TASK_REF_METHODS.has(cmd.method)) payload[TASK_REF_FIELD] = cmd.positionals[0]
  if (SESSION_REF_METHODS.has(cmd.method) && cmd.positionals[0]) payload[SESSION_REF_FIELD] = cmd.positionals[0]
  if (cmd.method === CLI_METHOD.handoff) payload[SAME_WORKTREE_FIELD] = payload[SAME_WORKTREE_FIELD] === true
  return { method: cmd.method, payload }
}
