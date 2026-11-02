import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { TargetId } from '../../lib/targets.ts'
import { MINI_DIST } from './fixture-paths.ts'

export const PROOF_NAMES = { productName: 'Pragma ADE', executableName: 'pragma-ade' } as const
export const PROOF_NATIVES = ['better-sqlite3', 'node-pty', '@parcel/watcher'] as const

/** An artifact of the toolchain proof (`toolchain.int.ts` must have run); undefined when absent. */
export function proofArtifact(target: TargetId, ext: string): string | undefined {
  const dir = join(MINI_DIST, target)
  if (!existsSync(dir)) return undefined
  const name = readdirSync(dir).find((n) => n.endsWith(ext))
  return name ? join(dir, name) : undefined
}

export const proofOutputDir = (target: TargetId): string => join(MINI_DIST, target)
