import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TEMP_PREFIX } from './constants'

export interface TempDir {
  path: string
  cleanup(): void
}

/** A fresh temporary directory (for `PRAGMA_USER_DATA`, HOME, config dirs…). Never the real userData. */
export function createTempUserData(prefix = TEMP_PREFIX): TempDir {
  const path = mkdtempSync(join(tmpdir(), prefix))
  return { path, cleanup: () => rmSync(path, { recursive: true, force: true }) }
}
