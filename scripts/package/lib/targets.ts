import { DARWIN } from '../constants.ts'

export const TARGET_IDS = ['darwin-arm64', 'darwin-x64', 'linux-x64', 'win32-x64'] as const
export type TargetId = (typeof TARGET_IDS)[number]
export const PLATFORMS = ['darwin', 'linux', 'win32'] as const
export type TargetPlatform = (typeof PLATFORMS)[number]
export const TARGET_ARCHES = ['arm64', 'x64'] as const
export type TargetArch = (typeof TARGET_ARCHES)[number]
export const FORMAT = { macho: 'macho', elf: 'elf', pe: 'pe' } as const
export const BINARY_FORMATS = [FORMAT.macho, FORMAT.elf, FORMAT.pe] as const
export type BinaryFormat = (typeof BINARY_FORMATS)[number]
export const TARGET_ALIAS_NAMES = ['mac', 'linux', 'win', 'all'] as const
export type TargetAlias = (typeof TARGET_ALIAS_NAMES)[number]

export interface Target {
  id: TargetId
  platform: TargetPlatform
  arch: TargetArch
  builderPlatform: 'mac' | 'linux' | 'win'
  builderTargets: readonly string[]
  npm: { os: string; cpu: string; libc?: 'glibc' }
  binaryFormat: BinaryFormat
}

const MAC_TARGETS = ['dmg', 'zip'] as const
const mac = (arch: TargetArch): Target => ({
  id: `darwin-${arch}`,
  platform: DARWIN,
  arch,
  builderPlatform: 'mac',
  builderTargets: MAC_TARGETS,
  npm: { os: DARWIN, cpu: arch },
  binaryFormat: FORMAT.macho,
})

export const TARGETS: Readonly<Record<TargetId, Target>> = {
  'darwin-arm64': mac('arm64'),
  'darwin-x64': mac('x64'),
  'linux-x64': {
    id: 'linux-x64',
    platform: 'linux',
    arch: 'x64',
    builderPlatform: 'linux',
    builderTargets: ['AppImage', 'deb'],
    npm: { os: 'linux', cpu: 'x64', libc: 'glibc' },
    binaryFormat: 'elf',
  },
  'win32-x64': {
    id: 'win32-x64',
    platform: 'win32',
    arch: 'x64',
    builderPlatform: 'win',
    builderTargets: ['nsis', 'zip'],
    npm: { os: 'win32', cpu: 'x64' },
    binaryFormat: 'pe',
  },
}

export const TARGET_ALIASES: Readonly<Record<TargetAlias, readonly TargetId[]>> = {
  mac: ['darwin-arm64', 'darwin-x64'],
  linux: ['linux-x64'],
  win: ['win32-x64'],
  all: TARGET_IDS,
}

const isAlias = (s: string): s is TargetAlias => (TARGET_ALIAS_NAMES as readonly string[]).includes(s)
export const isTargetId = (s: string): s is TargetId => (TARGET_IDS as readonly string[]).includes(s)
export const isTargetSpec = (s: string): boolean => isAlias(s) || isTargetId(s)

/** Aliases and target ids → deduplicated target ids in `TARGET_IDS` order. */
export function parseTargets(args: readonly string[]): TargetId[] {
  const wanted = new Set<TargetId>()
  for (const arg of args) {
    if (isAlias(arg)) for (const id of TARGET_ALIASES[arg]) wanted.add(id)
    else if (isTargetId(arg)) wanted.add(arg)
    else throw new Error(`Unknown target "${arg}"`)
  }
  return TARGET_IDS.filter((id) => wanted.has(id))
}
