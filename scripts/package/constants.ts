/** Every shared literal and number of the packaging tool (§9.2). */
import type { Target } from './lib/targets.ts'

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

// --- staging ---
export const STAGE_APP_DIR = 'app'
export const STAGE_RESOURCES_DIR = 'resources'
export const BUNDLE_OUT_DIR = 'out'
export const RENDERER_DIR = 'renderer'
export const STAGED_APP_NAME = 'pragma-ade'
export const RESOURCE_PACKAGE_SUFFIX = '-resource'
export const RESOURCE_PACKAGE_VERSION = '0.0.0'
export const PREBUILDS_DIR = 'prebuilds'
export const NATIVE_EXT = '.node'
export const SPAWN_HELPER = 'spawn-helper'
export const EXEC_MODE = 0o755
export const EXEC_BITS = 0o111
export const ARCH_JOINER = '+'
export const PLATFORM_ARCH_SEP = '-'
/** No `--prefer-offline`: with cached packuments npm 11 skipped the `--os/--cpu` optional packages (RECON.md). */
export const NPM_INSTALL_ARGS = ['install', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'] as const
export const NPM_LOCK_ONLY_ARGS = ['install', '--package-lock-only', '--no-audit', '--no-fund'] as const
export const NPM_INSTALL_TIMEOUT_MS = 600_000
/** Package files that never run on the target (other platforms' payloads); paths are relative to the package dir. */
export const PRUNE_RULES: readonly { package: string; remove: (t: Target) => readonly string[] }[] = [
  {
    package: 'node-pty',
    remove: (t) =>
      t.platform === WIN32 ? [`third_party/conpty/*/win10-${t.arch === 'x64' ? 'arm64' : 'x64'}`] : ['third_party'],
  },
]

// --- natives and docker ---
export const NATIVE_MARKERS = ['binding.gyp', 'prebuilds'] as const
export const BUILD_DIR = 'build'
export const RELEASE_DIR = 'Release'
export const ELECTRON_HEADERS_URL = 'https://electronjs.org/headers'
export const NODE_GYP_VERSION = '13.1.0'
export const NODE_GYP_SCRIPT = 'node_modules/node-gyp/bin/node-gyp.js'
export const NATIVE_COMPILE_TIMEOUT_MS = 1_200_000
export const CACHE_KEY_SCOPE_SEP = '+'
export const DOCKER_APP_PATH = '/Applications/Docker.app'
export const OPEN_BIN = 'open'
export const DOCKER_POLL_MS = 2_000
export const DOCKER_START_TIMEOUT_MS = 180_000
export const DOCKER_PLATFORM = 'linux/amd64'
export const LINUX_BUILD_IMAGE = 'node:22-bullseye'
export const LINUX_PROBE_IMAGE = 'debian:bookworm-slim'
export const DOCKER_WORK_DIR = '/work'
export const GLIBC_BASELINE_MINOR = 31
export const LIST_SEP = ', '

// --- electron-builder and icon ---
export const BUILDER_CONFIG_FILE = 'electron-builder.yml'
export const BUILD_RESOURCES_DIR = 'build'
export const ICON_SVG = 'build/icon.svg'
export const ICON_PNG = 'build/icon.png'
export const ICON_SIZE_PX = 1024
export const ICON_RENDER_TIMEOUT_MS = 60_000
export const DESKTOP_DIR = 'apps/desktop'
export const ELECTRON_PACKAGE = 'electron'
export const CSC_DISCOVERY_ENV = 'CSC_IDENTITY_AUTO_DISCOVERY'
export const ELECTRON_RUN_AS_NODE_ENV = 'ELECTRON_RUN_AS_NODE'
export const ICON_FIELD = 'icon'
export const BUILDER_PLATFORM_KEYS = ['mac', 'linux', 'win'] as const
/** electron-builder leaves these next to the artifacts; Biome would lint the unpacked apps' JS (RECON.md). */
export const BUILDER_SCRATCH_FILES = ['builder-debug.yml', 'builder-effective-config.yaml'] as const
export const MIN_ARTIFACT_BYTES = 10_000_000

// --- archives, layout and probe ---
export const DITTO = 'ditto'
export const TAR = 'tar'
export const HDIUTIL = 'hdiutil'
export const ARCHIVE_EXT = { zip: '.zip', deb: '.deb', dmg: '.dmg', appImage: '.AppImage', exe: '.exe' } as const
export const DEB_DATA_PREFIX = 'data.tar'
export const APP_BUNDLE_EXT = '.app'
export const MAC_CONTENTS = 'Contents'
export const MAC_EXECUTABLE_DIR = 'MacOS'
export const MAC_RESOURCES_DIR = 'Resources'
export const RESOURCES_DIR = 'resources'
export const APP_ASAR = 'app.asar'
export const ASAR_UNPACKED_SUFFIX = '.unpacked'
export const DEB_INSTALL_ROOT = 'opt'
export const EXE_EXT = '.exe'
export const PROBE_SCRIPT = 'probe/natives.cjs'
export const PROBE_TIMEOUT_MS = 120_000
export const LINUX_PROBE_TIMEOUT_MS = 900_000
export const ENABLED = '1'
export const DOCKER_APP_MOUNT = '/app'
export const DOCKER_PROBE_MOUNT = '/probe'
export const LINUX_RUNTIME_LIBS = [
  'libnss3',
  'libatk1.0-0',
  'libatk-bridge2.0-0',
  'libcups2',
  'libdrm2',
  'libgtk-3-0',
  'libgbm1',
  'libasound2',
  'libxss1',
  'libxkbcommon0',
  'libxcomposite1',
  'libxdamage1',
  'libxrandr2',
  'libpango-1.0-0',
  'libcairo2',
] as const
export const EMULATION_CRASH = /qemu|rosetta error/i
export const SKIP_REASON = {
  docker: 'docker unavailable',
  emulation: 'emulation',
  unsupported: 'unsupported host',
} as const

// --- audit ---
export const FILE_BIN = 'file'
export const CODESIGN = 'codesign'
export const DEB_CONTROL_PREFIX = 'control.tar'
export const DEB_CONTROL_MEMBER = './control'
export const DEB_ARCHITECTURE = { x64: 'amd64', arm64: 'arm64' } as const
export const DEB_ARCH_FIELD = /^Architecture:\s*(\S+)/m
export const SQUASHFS_MAGIC = 'hsqs'
export const NSIS_MARKER = 'Nullsoft'
/** Bytes searched for the AppImage squashfs magic and the NSIS marker. */
export const MAGIC_SCAN_BYTES = 8_388_608
export const AUDIT_DETAIL_LIMIT = 10
export const BLOCKMAP_EXT = '.blockmap'
export const SHA_PREFIX_CHARS = 12

// --- orchestration and reports ---
export const DIST_DIR = 'dist'
export const MANIFEST_FILE = 'manifest.json'
export const SUMMARY_FILE = 'SUMMARY.md'
export const SMOKE_RESULTS_FILE = 'smoke-results.json'
export const BYTES_PER_MB = 1_048_576
export const MB_DECIMALS = 1
export const GIT = 'git'
export const BUILD_SCRIPT = 'build'
export const DOCKER_CONFIG_ENV = 'DOCKER_CONFIG'
export const DOCKER_HOST_ENV = 'DOCKER_HOST'
export const DOCKER_CONFIG_DIR = 'docker-config'
/** Anonymous pulls of public images: no `credsStore` (Docker Desktop's helper hung pulls on this Mac, RECON.md). */
export const DOCKER_ANON_CONFIG = '{"auths":{}}\n'
export const DOCKER_CONFIG_FILE = 'config.json'
export const LINUX = 'linux'
export const RUN_SUBCOMMAND = 'run'
export const STATUS = { ok: 'ok', failed: 'failed' } as const
export const SEVERITY = { error: 'error', warn: 'warn' } as const
export const PROBE_CHECK = 'probe'
export const MISSING = 'missing'
export const TAR_EXTRACT = '-xf'
/** electron-builder downloads (Electron zips, tool bundles) that failed this way are retried once. */
export const TRANSIENT_NETWORK_ERROR = /certificate|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|network/i

// --- smoke ---
export const SMOKE_CONFIG = 'test/e2e/packaging/playwright.config.ts'
export const SMOKE_DIST_ENV = 'PRAGMA_SMOKE_DIST'
export const SMOKE_TIMEOUT_MS = 1_800_000
export const PLAYWRIGHT_STATUS = { passed: 'passed', failed: 'failed', skipped: 'skipped' } as const
export const SKIP_ANNOTATION = 'skip'
/** dist/ is gitignored but Biome has no VCS ignore: a nested config keeps Biome out of the outputs (RECON.md). */
export const DIST_BIOME_FILE = 'biome.json'
export const DIST_BIOME_CONFIG = '{ "root": false, "files": { "includes": ["!**"] } }\n'
/** Required by electron-builder for Linux packages (deb/AppImage metadata); there is no public homepage yet. */
export const APP_HOMEPAGE = 'https://pragma-ade.localhost'
