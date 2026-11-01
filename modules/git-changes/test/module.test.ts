import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..')
const readJson = (rel: string) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'))
const pkg = readJson('package.json')
const en = readJson('locales/en.json')

describe('git-changes module manifest', () => {
  it.each([
    ['id', 'git-changes'],
    ['kind', 'feature'],
    ['displayNameKey', 'git-changes:module.name'],
    ['dependsOn', ['projects', 'comments']],
    ['optionalDependsOn', ['editor']],
    ['core', false],
  ])('pragma.%s', (field, value) => {
    expect(pkg.pragma[field]).toEqual(value)
  })

  it('is the @pragma/module-git-changes package with the four entries', () => {
    expect(pkg.name).toBe('@pragma/module-git-changes')
    expect(Object.keys(pkg.exports).sort()).toEqual(['./contract', './main', './renderer', './testing'])
  })

  it.each([
    ['module.name', en.module?.name],
    ['tab.title', en.tab?.title],
  ])('en.json %s is Git Changes', (_key, value) => {
    expect(value).toBe('Git Changes')
  })
})
