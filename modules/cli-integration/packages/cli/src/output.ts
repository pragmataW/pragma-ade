import {
  ASK_STATE,
  CLI_ERROR,
  CLI_LOCAL_ERROR,
  CLI_METHOD,
  type CliMethod,
  type CliResult,
  type CliTaskDetail,
  type CliTranscript,
  type CliWorktree,
  EXIT_CODES,
  type ExitCode,
  MAX_DOCUMENT_BYTES,
} from '@pragma/module-cli-integration/contract'
import { UsageError } from './args'
import { AppError } from './client'
import { NotRunningError } from './connection'
import {
  COLUMN_GAP,
  COMMENT_ACTION_TEXT,
  DESCRIPTION_HEADING,
  DETACHED,
  EMPTY_CELL,
  ERROR_PREFIX,
  HANDOFF_HINT,
  JSON_INDENT,
  LINE_BREAKS_RE,
  MAIN_MARK,
  NEWLINE,
  NO_DESCRIPTION,
  NO_THREADS,
  NOT_RUNNING_TEXT,
  THREADS_HEADER,
  TRAILING_NEWLINES_RE,
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

/** `pragma ask`: the answer alone, so agents can read stdout as-is. */
function answerText(result: CliResult<'ask'>): string {
  if (result.status !== ASK_STATE.answered) return ''
  const text = result.text.endsWith(NEWLINE) ? result.text : `${result.text}${NEWLINE}`
  return result.truncated ? `${text}${NEWLINE}[answer truncated at ${MAX_DOCUMENT_BYTES} bytes]${NEWLINE}` : text
}

const LIST_JOIN = ', '
const KEY_VALUE = ': '
const ID = 'ID'
const HEADERS = {
  worktrees: [ID, 'BRANCH', 'PATH'],
  sessions: [ID, 'PROFILE', 'STATUS', 'PROVIDER SESSION', 'TITLE'],
  profiles: [ID, 'NAME', 'PROVIDER', 'ENABLED', 'DEFAULT'],
  tasks: [ID, 'KEY', 'COLUMN', 'PRIORITY', 'TITLE'],
  candidates: [ID, 'NAME', 'PROVIDER'],
  columns: [ID, 'NAME', 'TASKS', 'DESCRIPTION'],
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

/** A multi-line text as one cell; '' → `EMPTY_CELL`. */
const oneLine = (text: string): string => text.trim().replace(LINE_BREAKS_RE, ' ') || EMPTY_CELL

/** `key: value` lines for a single object. */
const keyValues = (o: Record<string, unknown>): string =>
  Object.entries(o)
    .map(([k, v]) => `${k}${KEY_VALUE}${cell(v)}`)
    .join(NEWLINE) + NEWLINE

const worktreeCell = (t: CliTaskDetail): string | null =>
  t.worktreeBranch && t.worktreeId ? `${t.worktreeBranch} (${t.worktreeId})` : t.worktreeId

/** `key: value` fields, then the description markdown verbatim under its own heading. */
function taskDetailText(t: CliTaskDetail): string {
  const fields = keyValues({
    key: t.key,
    id: t.id,
    title: t.title,
    column: t.column,
    ...(t.columnDescription ? { 'column description': oneLine(t.columnDescription) } : {}),
    priority: t.priority,
    labels: t.labels,
    worktree: worktreeCell(t),
    sessions: t.sessionIds,
  })
  const body = t.description.trim() ? t.description.replace(TRAILING_NEWLINES_RE, '') : NO_DESCRIPTION
  return fields + DESCRIPTION_HEADING + NEWLINE + body + NEWLINE
}

const transcriptText = (t: CliTranscript): string =>
  keyValues({
    provider: t.providerId,
    session: t.providerSessionId,
    path: t.path,
    format: t.format,
    cwd: t.cwd,
    ...(t.readCommand ? { read: t.readCommand } : {}),
    ...(t.extraPaths.length ? { related: t.extraPaths } : {}),
  })

function locateText(r: CliResult<'sessionLocate'>): string {
  const pragma = r.pragmaSessionId ? keyValues({ pragma: r.pragmaSessionId }) : ''
  return pragma + r.transcripts.map(transcriptText).join(NEWLINE) + NEWLINE + HANDOFF_HINT
}

function commentsListText(r: CliResult<'commentsList'>): string {
  if (r.comments.length === 0) return NO_THREADS(r.status) + NEWLINE
  const blocks = r.comments.map((c) => c.text)
  return [THREADS_HEADER(r.round, r.comments.length, r.status), ...blocks].join(NEWLINE + NEWLINE) + NEWLINE
}

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
        r.sessions.map((s) => [s.id, cell(s.profileName), s.status, cell(s.providerSessionId), cell(s.title)]),
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
    case CLI_METHOD.taskColumns: {
      const r = result as CliResult<'taskColumns'>
      return formatTable(
        HEADERS.columns,
        r.columns.map((c) => [String(c.id), c.name, String(c.taskCount), oneLine(c.description)]),
      )
    }
    case CLI_METHOD.commentsList:
      return commentsListText(result as CliResult<'commentsList'>)
    case CLI_METHOD.commentsShow:
      return (result as CliResult<'commentsShow'>).text + NEWLINE
    case CLI_METHOD.commentsReply:
    case CLI_METHOD.commentsResolve:
    case CLI_METHOD.commentsReopen:
      return COMMENT_ACTION_TEXT[method]((result as CliResult<typeof method>).id) + NEWLINE
    case CLI_METHOD.handoff: {
      const { session, worktree } = result as CliResult<'handoff'>
      const branch = worktree.branch ?? DETACHED
      return `Handed off to ${cell(session.profileName)} in ${branch} (${worktree.path}), session ${session.id}${NEWLINE}`
    }
    case CLI_METHOD.taskShow:
      return taskDetailText(result as CliTaskDetail)
    case CLI_METHOD.sessionLocate:
      return locateText(result as CliResult<'sessionLocate'>)
    case CLI_METHOD.ask:
    case CLI_METHOD.askWait:
      return answerText(result as CliResult<'ask'>)
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
