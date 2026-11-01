import { chmodSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import {
  BUILD_RELEASE_DIR,
  HELPER_MODE,
  IGNORED_FS_ERRORS,
  NODE_PTY_PACKAGE_JSON,
  PREBUILDS_DIR,
  SPAWN_HELPER,
  WIN32,
} from './constants'

const errorCode = (error: unknown): string | undefined =>
  error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : undefined

function defaultNodePtyDir(): string | undefined {
  try {
    return dirname(createRequire(__filename).resolve(NODE_PTY_PACKAGE_JSON))
  } catch {
    return undefined
  }
}

/**
 * node-pty 1.1.0 ships its prebuilt `spawn-helper` as 0644, which makes every spawn fail with
 * `posix_spawnp failed`. Makes the helper executable; a missing helper or a read-only install is ignored.
 */
export function ensureSpawnHelperExecutable(nodePtyDir: string | undefined = defaultNodePtyDir()): void {
  if (process.platform === WIN32 || nodePtyDir === undefined) return
  const candidates = [
    join(nodePtyDir, PREBUILDS_DIR, `${process.platform}-${process.arch}`, SPAWN_HELPER),
    join(nodePtyDir, ...BUILD_RELEASE_DIR, SPAWN_HELPER),
  ]
  for (const path of candidates) {
    try {
      chmodSync(path, HELPER_MODE)
    } catch (error) {
      if (!IGNORED_FS_ERRORS.includes(errorCode(error) ?? '')) throw error
    }
  }
}
