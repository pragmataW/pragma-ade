import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { tempDir } from './support/bridge-file'

const PKG_DIR = join(import.meta.dirname, '..')
const BUNDLE = join(PKG_DIR, 'dist', 'pragma.cjs')
const BUILD_TIMEOUT_MS = 60_000

beforeAll(() => {
  if (!existsSync(BUNDLE)) execFileSync(process.execPath, [join(PKG_DIR, 'build.mjs')])
}, BUILD_TIMEOUT_MS)

/** Runs the bundle with a clean env: temp HOME/userData, no bridge or agent variables from the caller. */
function runBundle(args: string[]) {
  const home = tempDir()
  const env = { PATH: process.env.PATH ?? '', HOME: home, PRAGMA_USER_DATA: home }
  return spawnSync(process.execPath, [BUNDLE, ...args], { env, encoding: 'utf8' })
}

describe('dist/pragma.cjs', () => {
  it('--help exits 0 and lists handoff', () => {
    const r = runBundle(['--help'])
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('pragma handoff')
  })

  it('without a running app exits 3', () => {
    const r = runBundle(['worktree', 'list'])
    expect(r.status).toBe(3)
    expect(r.stderr).toContain('Pragma ADE is not running')
  })
})
