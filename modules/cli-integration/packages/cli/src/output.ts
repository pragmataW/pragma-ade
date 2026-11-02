import {
  CLI_ERROR,
  CLI_LOCAL_ERROR,
  CLI_METHOD,
  type CliComment,
  type CliMethod,
  type CliResult,
  type CliWorktree,
  EXIT_CODES,
  type ExitCode,
} from '@pragma/module-cli-integration/contract'
import { UsageError } from './args'
import { AppError } from './client'
import { NotRunningError } from './connection'
import {
  COLUMN_GAP,
  COMMENT_PREVIEW_CHARS,
  DETACHED,
  EMPTY_CELL,
  ERROR_PREFIX,
  JSON_INDENT,
  MAIN_MARK,
  NEWLINE,
  NOT_RUNNING_TEXT,
  USAGE_FOOTER,
  YES_NO,
} from './constants'

const STDOUT = 'stdout'
const STDERR = 'stderr'
export interface FormattedError {
  text: string
  exitCode: ExitCode
  stream: typeof STDOUT | typeof STDERR
}

const LIST_JOIN = ', '
const KEY_VALUE = ': '
const RANGE = '-'
const LOCATION_SEP = ':'
const ID = 'ID'
const HEADERS = {
  worktrees: [ID, 'BRANCH', 'PATH'],
  sessions: [ID, 'PROFILE', 'STATUS', 'TITLE'],
  profiles: [ID, 'NAME', 'PROVIDER', 'ENABLED', 'DEFAULT'],
  tasks: [ID, 'KEY', 'COLUMN', 'PRIORITY', 'TITLE'],
  comments: [ID, 'LOCATION', 'BODY'],
  candidates: [ID, 'NAME', 'PROVIDER'],
} as const

/** Plain-text table; every column padded to its widest cell (Contract issue: belongs in the SDK, §9.1). */
export function formatTable(headers: readonly string[], rows: string[][]): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)))
  const line = (cells: readonly string[]) =>
    cells
      .map((c, i) => c.padEnd(widths[i] ?? 0))
      .join(COLUMN_GAP)
      .trimEnd()
  return [headers, ...rows].map(line).join(NEWLINE) + NEWLINE
}

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return EMPTY_CELL
  if (Array.isArray(v)) return v.length ? v.join(LIST_JOIN) : EMPTY_CELL
  return String(v)
}
const yesNo = (b: boolean): string => (b ? YES_NO.yes : YES_NO.no)
const branchCell = (w: CliWorktree): string => (w.branch ?? DETACHED) + (w.isMain ? MAIN_MARK : '')

function location(c: CliComment): string {
  if (!c.filePath) return c.source
  if (c.lineStart === null) return c.filePath
  const end = c.lineEnd !== null && c.lineEnd !== c.lineStart ? `${RANGE}${c.lineEnd}` : ''
  return `${c.filePath}${LOCATION_SEP}${c.lineStart}${end}`
}
const preview = (body: string): string => (body.split(NEWLINE)[0] ?? '').slice(0, COMMENT_PREVIEW_CHARS)

/** `key: value` lines for a single object. */
const keyValues = (o: Record<string, unknown>): string =>
  Object.entries(o)
    .map(([k, v]) => `${k}${KEY_VALUE}${cell(v)}`)
    .join(NEWLINE) + NEWLINE

function humanResult(method: CliMethod, result: unknown): string {
  switch (method) {
    case CLI_METHOD.worktreeList: {
      const r = result as CliResult<'worktreeList'>
      return formatTable(
        HEADERS.worktrees,
        r.worktrees.map((w) => [w.id, branchCell(w), w.path]),
      )
    }
    case CLI_METHOD.agentList: {
      const r = result as CliResult<'agentList'>
      return formatTable(
        HEADERS.sessions,
        r.sessions.map((s) => [s.id, cell(s.profileName), s.status, cell(s.title)]),
      )
    }
    case CLI_METHOD.profileList: {
      const r = result as CliResult<'profileList'>
      return formatTable(
        HEADERS.profiles,
        r.profiles.map((p) => [p.id, p.name, p.providerId, yesNo(p.enabled), yesNo(p.isDefault)]),
      )
    }
    case CLI_METHOD.taskList: {
      const r = result as CliResult<'taskList'>
      return formatTable(
        HEADERS.tasks,
        r.tasks.map((t) => [String(t.id), t.key, t.column, t.priority, t.title]),
      )
    }
    case CLI_METHOD.commentsList: {
      const r = result as CliResult<'commentsList'>
      return formatTable(
        HEADERS.comments,
        r.comments.map((c) => [c.id, location(c), preview(c.body)]),
      )
    }
    case CLI_METHOD.handoff: {
      const { session, worktree } = result as CliResult<'handoff'>
      const branch = worktree.branch ?? DETACHED
      return `Handed off to ${cell(session.profileName)} in ${branch} (${worktree.path}), session ${session.id}${NEWLINE}`
    }
    case CLI_METHOD.worktreeCreate:
    case CLI_METHOD.agentSpawn:
    case CLI_METHOD.taskCreate:
    case CLI_METHOD.taskUpdate:
    case CLI_METHOD.taskMove:
      return keyValues(result as Record<string, unknown>)
    default: {
      const never: never = method
      throw new Error(`unhandled method ${String(never)}`)
    }
  }
}

const json = (doc: unknown): string => `${JSON.stringify(doc, null, JSON_INDENT)}${NEWLINE}`

export function formatResult(method: CliMethod, result: unknown, asJson: boolean): string {
  return asJson ? json({ ok: true, result }) : humanResult(method, result)
}

interface ErrorParts {
  code: string
  message: string
  exitCode: ExitCode
  human: string
  details?: Record<string, unknown>
}

function candidatesText(details: Record<string, unknown> | undefined): string {
  const list = details?.candidates
  if (!Array.isArray(list)) return ''
  const rows = (list as Record<string, unknown>[]).map((c) => [cell(c.id), cell(c.name), cell(c.providerId)])
  return formatTable(HEADERS.candidates, rows)
}

function errorParts(err: unknown): ErrorParts {
  if (err instanceof UsageError)
    return {
      code: CLI_LOCAL_ERROR.usage,
      message: err.message,
      exitCode: EXIT_CODES.usage,
      human: `${ERROR_PREFIX}${err.message}${NEWLINE}${USAGE_FOOTER}${NEWLINE}`,
    }
  if (err instanceof NotRunningError) {
    const hint = err.hint ? `${err.hint}${NEWLINE}` : ''
    const human = `${NOT_RUNNING_TEXT}${NEWLINE}${hint}`
    return { code: CLI_LOCAL_ERROR.notRunning, message: err.message, exitCode: EXIT_CODES.notRunning, human }
  }
  const app = err instanceof AppError
  const message = err instanceof Error ? err.message : String(err)
  return {
    code: app ? err.code : CLI_ERROR.internal,
    message,
    exitCode: EXIT_CODES.appError,
    human: `${ERROR_PREFIX}${message}${NEWLINE}${app ? candidatesText(err.details) : ''}`,
    ...(app && err.details ? { details: err.details } : {}),
  }
}

/** Error → text, exit code and stream (`--json` keeps everything on stdout as one document). */
export function formatError(err: unknown, asJson: boolean): FormattedError {
  const p = errorParts(err)
  if (!asJson) return { text: p.human, exitCode: p.exitCode, stream: STDERR }
  const error = { code: p.code, message: p.message, ...(p.details ? { details: p.details } : {}) }
  return { text: json({ ok: false, error }), exitCode: p.exitCode, stream: STDOUT }
}
