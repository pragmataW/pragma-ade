/** CLI-only constants (§9.2); literals shared with the app live in the module contract. */
export const CLI_NAME = 'pragma'
export const HELP_FLAGS: readonly string[] = ['-h', '--help']
export const VERSION_FLAG = '--version'
export const LIST_SEPARATOR = ','
export const STDIN_PATH = '-'
export const GLOBAL_HELP = [
  'Global options:',
  '  --json       print one JSON document: {"ok":true,"result":…} or {"ok":false,"error":{…}}',
  '  -h, --help   show help (also after a command group, e.g. pragma task --help)',
  '  --version    print the CLI version',
  '',
  'Exit codes: 0 ok, 1 app-side error, 2 usage error, 3 Pragma ADE not running.',
].join('\n')
export const NO_BRIDGE_INFO = 'Pragma ADE is not running (no bridge info found).'
export const NOT_RUNNING_HINTS = {
  missingFile: (file: string) => `PRAGMA_BRIDGE_FILE points at ${file}, which does not exist.`,
  tokenRejected: 'The bridge token was rejected (stale bridge.json from an earlier run?).',
  unreachable: (url: string) => `Nothing answered at ${url} (stale bridge.json from an earlier run?).`,
} as const
export const CONNECT_TIMEOUT_MS = 3000
/** handoff may create a worktree and start an agent. */
export const RESPONSE_TIMEOUT_MS = 120_000
const ALL_STATUS = 'all'
const statusWord = (status: string): string => (status === ALL_STATUS ? '' : `${status} `)
/** `comments list` header: `Review round 2 · 3 open threads`. */
export const THREADS_HEADER = (round: number, count: number, status: string): string =>
  `Review round ${round} · ${count} ${statusWord(status)}${count === 1 ? 'thread' : 'threads'}`
/** `comments list` with nothing to show. */
export const NO_THREADS = (status: string): string => `No ${statusWord(status)}review threads.`
/** One confirmation line per thread action. */
export const COMMENT_ACTION_TEXT = {
  commentsReply: (id: string) => `Replied to ${id}.`,
  commentsResolve: (id: string) => `Resolved ${id}.`,
  commentsReopen: (id: string) => `Reopened ${id}.`,
} as const
export const COLUMN_GAP = '  '
export const MAIN_MARK = ' *'
export const EMPTY_CELL = '-'
export const DETACHED = '(detached)'
export const YES_NO = { yes: 'yes', no: 'no' } as const
export const NEWLINE = '\n'
/** Printed after `pragma session locate` (human output only). */
export const HANDOFF_HINT = [
  'To continue in another agent, put the path in a prompt file and run:',
  '  pragma agent spawn --profile <name> --prompt-file <file>',
  '',
].join(NEWLINE)
export const JSON_INDENT = 2
export const UTF8 = 'utf8'
export const NOT_RUNNING_TEXT = 'Pragma ADE is not running. Start the app and try again.'
export const TOKEN_REJECTED = 'Pragma ADE is not running (the bridge token was rejected).'
export const UNREACHABLE = 'Pragma ADE is not running (nothing answered at the bridge address).'
export const USAGE_FOOTER = "Run 'pragma --help' for usage."
export const ERROR_PREFIX = 'Error: '
export const VERSION_MISMATCH = 'Unexpected response from Pragma ADE (version mismatch?)'
export const CLI_DISABLED = 'Pragma ADE is running but its command line module is disabled (Settings > Modules).'
/** `node` and the script path. */
export const ARGV_SKIP = 2
