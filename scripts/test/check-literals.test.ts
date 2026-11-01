import { relative, resolve } from 'node:path'
import { globSync } from 'tinyglobby'
import { expect, test } from 'vitest'
import { checkLiterals, type LiteralFinding } from '../lib/literals.ts'

const repoRoot = resolve(import.meta.dirname, '../..')
const FIXTURE = 'scripts/test/fixtures/literals'
const fixtureDir = resolve(repoRoot, FIXTURE)
const globFixture = (dir: string): string[] =>
  globSync('**/*.{ts,tsx}', { cwd: resolve(repoRoot, dir), absolute: true })
const rel = (file: string): string => relative(fixtureDir, file)
const byRule = (findings: LiteralFinding[], rule: LiteralFinding['rule']) => findings.filter((f) => f.rule === rule)

const { findings, allowances } = checkLiterals({ repoRoot, files: globFixture(FIXTURE) })

test('reports repeated strings per package', () => {
  expect(
    byRule(findings, 'repeated-string')
      .map((f) => [rel(f.file), f.value, f.count])
      .sort(),
  ).toEqual([
    ['pkg-bad/src/a.ts', 'settings.json', 3],
    ['pkg-bad/src/a.ts', 'settings.json', 3],
    ['pkg-bad/src/b.tsx', 'pane-x', 2],
    ['pkg-bad/src/b.tsx', 'pane-x', 2],
    ['pkg-bad/src/b.tsx', 'settings.json', 3],
  ])
})
test('reports magic numbers except 0/1/-1 and named constants', () => {
  expect(byRule(findings, 'magic-number').map((f) => f.value)).toEqual(['250'])
})
test('lint-allow comments are listed, not reported', () => {
  expect(allowances).toEqual([expect.objectContaining({ rule: 'literals', reason: 'fixture exception' })])
})
test('repo is clean', () => expect(checkLiterals({ repoRoot }).findings).toEqual([]))
