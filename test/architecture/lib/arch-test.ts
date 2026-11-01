import { join } from 'node:path'
import { expect, it } from 'vitest'
import { formatViolations } from './report.ts'
import { type RuleName, runRule } from './rules.ts'
import { REPO_ROOT } from './workspace.ts'

export const FIXTURE_ROOT = join(REPO_ROOT, 'test/architecture/fixtures/violations')

/** Runs a rule on the repo (must be clean) and on the violations fixture (must give exactly `expected`). */
export function describeRule(rule: RuleName, expected: [string, number][]): void {
  it.each([
    ['repo', REPO_ROOT, []],
    ['fixture', FIXTURE_ROOT, expected],
  ] as const)(`${rule}: %s`, (_name, root, want) => {
    const violations = runRule(rule, root)
    const got = violations.map((v) => [v.file, v.line] as [string, number]).sort()
    expect(got, formatViolations(violations)).toEqual([...want].sort())
    expect(violations.every((v) => v.rule === rule)).toBe(true)
  })
}
