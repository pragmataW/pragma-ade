import { expect, test } from 'vitest'
import pkg from '../package.json'

test('manifest declares the projects module', () => {
  expect(pkg.name).toBe('@pragma/module-projects')
  expect(pkg.pragma).toMatchObject({
    id: 'projects',
    kind: 'feature',
    displayNameKey: 'projects:module.name',
    dependsOn: [],
    core: true,
  })
  expect(Object.keys(pkg.exports)).toEqual(expect.arrayContaining(['./contract', './main', './renderer']))
})

test('internal deps are sdk/ui only, watcher pinned, no electron', () => {
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies })
  expect(deps.filter((d) => d.startsWith('@pragma/')).sort()).toEqual(['@pragma/sdk', '@pragma/ui'])
  expect(deps).not.toContain('electron')
  expect(pkg.dependencies['@parcel/watcher']).toBe('2.6.0')
})
