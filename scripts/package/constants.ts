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

// --- binary headers (Mach-O, fat, ELF, PE) ---
export const HEADER_BYTES = 512
export const MACHO64_MAGIC_LE = 0xfeedfacf
export const MACHO_CPUTYPE_OFFSET = 4
export const MACHO_FILETYPE_OFFSET = 12
export const MH_EXECUTE = 2
export const CPU_TYPE = { x64: 0x01000007, arm64: 0x0100000c, ia32: 0x00000007 } as const
export const FAT_MAGIC = 0xcafebabe
export const FAT_MAGIC_64 = 0xcafebabf
export const FAT_NARCH_OFFSET = 4
export const FAT_ENTRIES_OFFSET = 8
export const FAT_ENTRY_STRIDE = 20
export const FAT64_ENTRY_STRIDE = 32
export const MAX_FAT_ARCHES = 20
export const ELF_MAGIC = 0x7f454c46
export const ELF_TYPE_OFFSET = 16
export const ELF_MACHINE_OFFSET = 18
export const ET_EXEC = 2
export const ELF_MACHINE = { x64: 0x3e, arm64: 0xb7, ia32: 0x03 } as const
export const MZ_MAGIC = 0x5a4d
export const PE_LFANEW_OFFSET = 0x3c
export const PE_SIGNATURE = 0x00004550
export const PE_MACHINE_OFFSET = 4
export const PE_CHARACTERISTICS_OFFSET = 22
export const PE_DLL_FLAG = 0x2000
export const PE_MACHINE = { x64: 0x8664, arm64: 0xaa64, ia32: 0x14c } as const
export const U16_BYTES = 2
export const U32_BYTES = 4

// --- workspace and manifests ---
export const PNPM_WORKSPACE_FILE = 'pnpm-workspace.yaml'
export const GLOB_STAR = '*'
export const GLOB_GLOBSTAR = '**'
export const GLOB_NEGATION = '!'
export const EXCLUDED_DIR_PREFIX = '_'
export const HIDDEN_DIR_PREFIX = '.'
export const OWNER_ROOTS = ['modules', 'providers'] as const
export const APP_ROOT = 'apps'
export const SUB_PACKAGES_DIR = 'packages'
export const RESOURCE_MODULES_DIR = 'modules'
export const PARENT_SEGMENT = '..'
export const POSIX_SEP = '/'
export const WIN_SEP = '\\'
/** Optional tool-only packages, loaded with non-literal specifiers (see lib/deps.ts). */
export const DEP = { yaml: 'yaml', asar: '@electron/asar', builder: 'electron-builder' } as const

// --- bundle externals ---
export const JS_EXTENSIONS = ['.js', '.cjs', '.mjs'] as const
const SPEC = String.raw`(['"])([^'"\n\r]+)\1`
/** Literal module specifiers: require(), import(), import/export … from, bare side-effect import. */
export const SPECIFIER_PATTERNS: readonly RegExp[] = [
  new RegExp(String.raw`\brequire\(\s*${SPEC}\s*\)`, 'g'),
  new RegExp(String.raw`\bimport\(\s*${SPEC}\s*\)`, 'g'),
  new RegExp(String.raw`\b(?:import|export)\b[^'"\x60;]*?\bfrom\s*${SPEC}`, 'g'),
  new RegExp(String.raw`\bimport\s*${SPEC}`, 'g'),
]
/** Index of the specifier capture group in `SPECIFIER_PATTERNS`. */
export const SPECIFIER_GROUP = 2
export const NODE_PROTOCOL = 'node:'
export const ELECTRON_MODULE = 'electron'
export const SCOPE_PREFIX = '@'
export const RELATIVE_PREFIX = '.'
export const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i
export const WORKSPACE_SCOPE = '@pragma/'
export const DEFAULT_ENTRY = 'index.js'
export const EXPORT_CONDITIONS = ['import', 'require', 'default'] as const
