import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach } from 'vitest'

/** A fresh temp dir per call, removed after the current test. */
export function useTempDirs(): () => string {
  const dirs: string[] = []
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
  })
  return () => {
    const dir = mkdtempSync(join(tmpdir(), 'pragma-bridge-test-'))
    dirs.push(dir)
    return dir
  }
}
