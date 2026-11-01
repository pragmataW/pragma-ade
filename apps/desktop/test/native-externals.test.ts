import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { isNativePackageDir } from '../vite/native-externals'

const pkg = (files: string[], dirs: string[] = []) => {
  const dir = mkdtempSync(join(tmpdir(), 'pragma-native-'))
  for (const d of dirs) mkdirSync(join(dir, d), { recursive: true })
  for (const f of files) writeFileSync(join(dir, f), '')
  return dir
}

it.each([
  ['binding.gyp', pkg(['package.json', 'binding.gyp']), true],
  ['prebuilds/', pkg(['package.json'], ['prebuilds/darwin-arm64']), true],
  ['build/Release/', pkg(['package.json'], ['build/Release']), true],
  ['plain package', pkg(['package.json', 'index.js']), false],
])('%s → native=%s', (_name, dir, expected) => {
  expect(isNativePackageDir(dir)).toBe(expected)
})
