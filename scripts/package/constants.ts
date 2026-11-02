/** Every shared literal and number of the packaging tool (§9.2). */

// --- host and doctor ---
export const MIN_FREE_DISK_GB = 15
export const NODE_MIN = '22.18.0'
export const BYTES_PER_GB = 1_073_741_824
export const STDERR_TAIL_CHARS = 2000
export const DOCTOR_PROBE_TIMEOUT_MS = 15_000
export const UNIT_TEST_TIMEOUT_MS = 30_000
export const INT_TEST_TIMEOUT_MS = 1_800_000
export const JSON_INDENT = 2
export const DOCTOR_LABEL_WIDTH = 16
export const EXIT = { ok: 0, failed: 1, incomplete: 2 } as const

// --- paths ---
export const CACHE_ENV = 'PRAGMA_PACKAGE_CACHE'
export const CACHE_DIR_NAME = '.cache/pragma-ade-build'
export const STAGE_DIR = 'stage'
export const NATIVES_DIR = 'natives'
export const NODE_MODULES = 'node_modules'
export const PACKAGE_JSON = 'package.json'
export const PACKAGE_LOCK = 'package-lock.json'
export const UTF8 = 'utf8'
export const STREAM_EVENT = { data: 'data', error: 'error', close: 'close', end: 'end' } as const
export const TEMP_LABEL_SEPARATOR = ' '
export const TOOL_DEP_MARKER = 'electron-builder'
export const PACKAGE_DIR_FROM_REPO = 'scripts/package'

// --- commands ---
export const NODE = 'node'
export const NPM = 'npm'
export const PNPM = 'pnpm'
export const DOCKER = 'docker'
export const WINE = 'wine'
export const ARCH = 'arch'
export const ARCH_X64_FLAG = '-x86_64'
export const TRUE_BIN = '/usr/bin/true'
export const SW_VERS = 'sw_vers'
export const VERSION_FLAG = '--version'
export const DARWIN = 'darwin'
export const WIN32 = 'win32'

// --- CLI ---
export const CMD = { doctor: 'doctor', build: 'build', audit: 'audit', smoke: 'smoke', all: 'all' } as const
export const COMMANDS = [CMD.doctor, CMD.build, CMD.audit, CMD.smoke, CMD.all] as const
/** `process.argv` = [node, script, ...user args]. */
export const ARGV_USER_START = 2
export const FLAGS = {
  repo: '--repo',
  skipAppBuild: '--skip-app-build',
  noDockerStart: '--no-docker-start',
  keepStage: '--keep-stage',
  deep: '--deep',
  json: '--json',
} as const
