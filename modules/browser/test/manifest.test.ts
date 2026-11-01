import { expect, it } from 'vitest'
import en from '../locales/en.json'
import pkg from '../package.json'

it('declares the browser manifest', () => {
  expect(pkg.name).toBe('@pragma/module-browser')
  expect(pkg.pragma).toMatchObject({
    id: 'browser',
    kind: 'feature',
    dependsOn: ['projects'],
    optionalDependsOn: ['comments'],
    core: false,
  })
  expect(Object.keys(pkg.exports)).toEqual(['./contract', './main', './renderer'])
})

it('locale has the module name', () => expect(en.module.name).toBe('Browser'))
