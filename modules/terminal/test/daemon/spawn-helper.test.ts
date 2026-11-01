import { chmodSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { ensureSpawnHelperExecutable } from '../../packages/pty-daemon/src/spawn-helper'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

test.skipIf(process.platform === 'win32')('makes a 0644 prebuilt helper executable', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pragma-node-pty-'))
  dirs.push(dir)
  const prebuilds = join(dir, 'prebuilds', `${process.platform}-${process.arch}`)
  mkdirSync(prebuilds, { recursive: true })
  const helper = join(prebuilds, 'spawn-helper')
  writeFileSync(helper, '')
  chmodSync(helper, 0o644)
  ensureSpawnHelperExecutable(dir)
  expect(statSync(helper).mode & 0o111).toBe(0o111)
})

test('no-op when helper missing', () => expect(() => ensureSpawnHelperExecutable('/nonexistent')).not.toThrow())

test('default lookup finds the installed node-pty without throwing', () =>
  expect(() => ensureSpawnHelperExecutable()).not.toThrow())
