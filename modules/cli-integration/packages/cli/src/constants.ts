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
