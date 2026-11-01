import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { SessionTempDirs } from '../../src/main/launch/session-temp'

const MODE_BITS = 0o777
let base: string
let root: string
beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'agents-temp-'))
  root = join(base, 'agents', 'tmp')
})
afterEach(() => rmSync(base, { recursive: true, force: true }))

it('create makes 0700 dir', async () => {
  const t = await new SessionTempDirs(root).create('s1')
  expect(t.dir).toBe(join(root, 's1'))
  expect(statSync(t.dir).mode & MODE_BITS).toBe(0o700)
})

it('writeTempFile writes 0600 and rejects "../x" and "a/b"', async () => {
  const t = await new SessionTempDirs(root).create('s1')
  const path = await t.writeTempFile('initial-prompt.md', 'hello')
  expect(readFileSync(path, 'utf8')).toBe('hello')
  expect(statSync(path).mode & MODE_BITS).toBe(0o600)
  for (const bad of ['../x', 'a/b', 'a\\b', '..', ''])
    await expect(t.writeTempFile(bad, 'x')).rejects.toThrow(/invalid temp file name/)
})

it('remove deletes dir and extra files', async () => {
  const dirs = new SessionTempDirs(root)
  const t = await dirs.create('s1')
  await t.writeTempFile('a.txt', 'a')
  const extra = join(base, 'extra.txt')
  writeFileSync(extra, 'x')
  await dirs.remove('s1', [extra])
  expect(existsSync(t.dir)).toBe(false)
  expect(existsSync(extra)).toBe(false)
})

it('sweepAll empties root', async () => {
  const dirs = new SessionTempDirs(root)
  await dirs.create('s1')
  await dirs.create('s2')
  await dirs.sweepAll()
  expect(readdirSync(root)).toEqual([])
})
