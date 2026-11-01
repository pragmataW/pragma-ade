import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

interface JscpdConfig {
  minTokens: number
  threshold: number
  format: string[]
  exitCode: number
  ignore: string[]
}

const repoRoot = resolve(import.meta.dirname, '../..')
const jscpdConfig = JSON.parse(readFileSync(resolve(repoRoot, '.jscpd.json'), 'utf8')) as JscpdConfig
const JSCPD_BIN = resolve(repoRoot, 'node_modules/.bin/jscpd')

/** Runs jscpd with the repo config as flags; ignores that would hide the target dir itself are dropped. */
function runJscpd(dir: string) {
  const ignore = jscpdConfig.ignore.filter((glob) => !dir.startsWith(glob.replace('/**', '')))
  const args = [
    dir,
    '--min-tokens',
    String(jscpdConfig.minTokens),
    '--threshold',
    String(jscpdConfig.threshold),
    '--exit-code',
    String(jscpdConfig.exitCode),
    '-f',
    jscpdConfig.format.join(','),
    '-i',
    ignore.join(','),
    '-s',
    '--no-gitignore',
  ]
  return spawnSync(JSCPD_BIN, args, { cwd: repoRoot, encoding: 'utf8' })
}

test.each([
  ['scripts/test/fixtures/dup', 1],
  ['scripts/lib', 0],
])('jscpd on %s exits %i', (dir, code) => {
  expect(runJscpd(dir).status).toBe(code)
})
test('vendor dir is the only source exclusion', () => {
  expect(jscpdConfig.ignore.filter((g) => g.startsWith('packages/'))).toEqual(['packages/ui/src/vendor/**'])
})
