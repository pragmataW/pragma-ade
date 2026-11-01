import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it, test } from 'vitest'
import { z } from 'zod'
import { readJsonFile, writeFileAtomic } from '../src/main/fs'
import { tempDir } from './lib/builders'

const MODE_MASK = 0o777
const PRIVATE_MODE = 0o600

test('writeFileAtomic writes content and mode', () => {
  const file = join(tempDir(), 'nested', 'a.json')
  writeFileAtomic(file, 'hello', { mode: PRIVATE_MODE })
  expect(readFileSync(file, 'utf8')).toBe('hello')
  expect(statSync(file).mode & MODE_MASK).toBe(PRIVATE_MODE)
})
test('no temp file remains after success', () => {
  const dir = tempDir()
  writeFileAtomic(join(dir, 'a.txt'), new Uint8Array([1, 2]))
  expect(readdirSync(dir)).toEqual(['a.txt'])
})
test('failure (target is a directory) leaves the old file untouched and removes the temp file', () => {
  const dir = tempDir()
  const target = join(dir, 'target')
  mkdirSync(join(target, 'child'), { recursive: true })
  writeFileSync(join(dir, 'keep.txt'), 'old')
  expect(() => writeFileAtomic(target, 'x')).toThrow()
  expect(readdirSync(dir).sort()).toEqual(['keep.txt', 'target'])
  expect(readFileSync(join(dir, 'keep.txt'), 'utf8')).toBe('old')
})

const Schema = z.object({ a: z.number() })
it.each([
  ['missing', undefined, { ok: false, reason: 'missing' }],
  ['invalid JSON', '{nope', { ok: false, reason: 'invalid-json' }],
  ['schema mismatch', '{"a":"x"}', { ok: false, reason: 'schema' }],
  ['ok', '{"a":1}', { ok: true, value: { a: 1 } }],
])('readJsonFile: %s', (_name, contents, expected) => {
  const file = join(tempDir(), 'f.json')
  if (contents !== undefined) writeFileSync(file, contents)
  expect(readJsonFile(file, Schema)).toMatchObject(expected)
})
