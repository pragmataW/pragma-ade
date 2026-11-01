import { expect, it } from 'vitest'
import en from '../locales/en.json'
import pkg from '../package.json'

it('manifest declares agents feature with required deps', () => {
  expect(pkg.name).toBe('@pragma/module-agents')
  expect(pkg.pragma).toMatchObject({ id: 'agents', kind: 'feature', dependsOn: ['projects', 'terminal'], core: false })
  expect(Object.keys(pkg.exports)).toEqual(['./contract', './main', './renderer', './testing'])
})

it('locale has the module name', () => expect(en.module.name).toBe('Agents'))
