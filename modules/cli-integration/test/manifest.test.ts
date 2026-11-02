import { expect, test } from 'vitest'
import pkg from '../package.json'

test('manifest declares cli-integration module', () => {
  expect(pkg.name).toBe('@pragma/module-cli-integration')
  expect(pkg.pragma).toMatchObject({
    id: 'cli-integration',
    kind: 'feature',
    core: false,
    dependsOn: ['projects', 'agents', 'bridge'],
    optionalDependsOn: ['board', 'comments'],
  })
  expect(pkg.pragma.package.extraResources).toEqual([
    { from: 'packages/cli/dist/pragma.cjs', to: 'packages/cli/dist/pragma.cjs' },
    { from: 'skills', to: 'skills' },
  ])
  expect(Object.keys(pkg.exports)).toEqual(['./contract', './main', './renderer', './testing'])
})
