import { expect, test } from 'vitest'
import en from '../locales/en.json'
import pkg from '../package.json'

test('manifest declares board module with required and optional deps', () => {
  expect(pkg.name).toBe('@pragma/module-board')
  expect(pkg.pragma).toMatchObject({
    id: 'board',
    kind: 'feature',
    dependsOn: ['projects', 'agents'],
    optionalDependsOn: ['agent-status'],
    core: false,
  })
})

test('locale has module name', () => {
  expect(en.module.name).toBe('Task Board')
})
