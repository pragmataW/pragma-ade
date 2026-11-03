/** Every shared literal and number of the release helper (§9.2). */

export const UTF8 = 'utf8'
export const PACKAGE_JSON = 'package.json'
export const README = 'README.md'
export const CHANGELOG = 'CHANGELOG.md'
export const PACKAGE_LOCKS = ['scripts/package/package-lock.json'] as const
/** Tracked package.json files under these segments are never bumped. */
export const BUMP_EXCLUDED_SEGMENTS = ['/fixtures/', '/node_modules/'] as const
export const GIT = 'git'
export const GIT_LS_FILES = ['ls-files', '-z', '--', `*${PACKAGE_JSON}`] as const
export const NUL = '\0'
export const NEWLINE = '\n'

export const REPO_URL = 'https://github.com/pragmataW/pragma-ade'
export const TAG_PREFIX = 'v'
export const RELEASE_TITLE_PREFIX = 'Pragma ADE '

export const BUMP_KINDS = ['major', 'minor', 'patch'] as const
export const SEMVER = /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)$/

/** `"version": "x"` in a package.json or lockfile; group 1 is the prefix, group 2 the closing quote. */
export const versionField = (version: string): RegExp => new RegExp(`("version":\\s*")${escapeRegExp(version)}(")`)
/** README spots that carry the release version: release URLs, file names and the `[vX release]` link text. */
export const readmeVersion = (version: string): RegExp =>
  new RegExp(`(releases/(?:download|tag)/v|pragma-ade-|\\[v)${escapeRegExp(version)}`, 'g')
export const LOCK_VERSION_FIELDS = 2

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// --- changelog ---
export const SECTION_HEADING = '## ['
export const UNRELEASED = 'Unreleased'
export const LINK_REF = /^\[[^\]]+\]: /
export const CHANGELOG_GROUPS = ['Added', 'Changed', 'Fixed'] as const
/** Conventional Commit type → Keep a Changelog group; unlisted types (test, chore, docs, ci, build, style) are dropped. */
export const TYPE_GROUP = { feat: 'Added', fix: 'Fixed', perf: 'Changed', refactor: 'Changed' } as const
export const CONVENTIONAL = /^(?<type>\w+)(?:\((?<scope>[^)]*)\))?!?:\s*(?<text>.+)$/
export const DRAFT_HEADER = '<!-- Draft from commits since the last tag. Edit it into the CHANGELOG house style. -->'
export const EMPTY_DRAFT = '- TODO: describe this release.'

// --- assets and cask ---
export const ASSET_TARGETS = [
  { dir: 'darwin-arm64', files: ['mac-arm64.dmg', 'mac-arm64.zip'] },
  { dir: 'darwin-x64', files: ['mac-x64.dmg', 'mac-x64.zip'] },
  { dir: 'linux-x64', files: ['linux-amd64.deb', 'linux-x86_64.AppImage'] },
  { dir: 'win32-x64', files: ['win-x64-setup.exe', 'win-x64.zip'] },
] as const
export const DIST_DIR = 'dist'
export const ASSET_PREFIX = 'pragma-ade-'
export const CASK_ARCH_ASSETS = { arm: 'mac-arm64.zip', intel: 'mac-x64.zip' } as const
export const SUMS_LINE = /^(?<sha>[0-9a-f]{64})\s+\*?(?<name>.+)$/
export const VERSION_WORD = 'version'
export const CASK_VERSION = /(\n\s*version\s+")[^"]+(")/
export const caskSha = (arch: string): RegExp => new RegExp(`(${arch}:\\s+")[0-9a-f]{64}(")`)

// --- CLI ---
export const ARGV_USER_START = 2
export const EXIT_FAILED = 1
/** Argument counts of the multi-argument commands. */
export const ARGC = { insertSection: 3, cask: 3 } as const
export const USAGE = `usage: node scripts/release/cli.ts <command>
  current                              print the root package.json version
  next <X.Y.Z|patch|minor|major>       print the next version
  bump <X.Y.Z>                         bump package.json files, lockfiles and README links
  has-section <X.Y.Z>                  exit 0 when CHANGELOG.md has that section
  section <X.Y.Z>                      print that CHANGELOG.md section body (release notes)
  insert-section <X.Y.Z> <date> <file> add a CHANGELOG.md section from a notes file
  draft                                draft notes from commit subjects on stdin
  assets <X.Y.Z>                       print the expected release asset paths
  cask <file> <X.Y.Z> <SHA256SUMS>     update a Homebrew cask in place`
