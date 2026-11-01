import { expect, test } from 'vitest'
import en from '../locales/en.json'
import pkg from '../package.json'
import daemonPkg from '../packages/pty-daemon/package.json'

test('terminal manifest', () => {
  expect(pkg.name).toBe('@pragma/module-terminal')
  expect(pkg.pragma).toMatchObject({
    id: 'terminal',
    kind: 'feature',
    displayNameKey: 'terminal:module.name',
    dependsOn: ['projects'],
    optionalDependsOn: [],
    core: false,
    build: 'build',
  })
  expect(pkg.scripts.build).toBe('node packages/pty-daemon/scripts/build.mjs')
  // no native deps (§10.4): only the daemon bundle is an extra resource
  expect(pkg.pragma.package.extraResources).toEqual([
    { from: 'packages/pty-daemon/dist', to: 'packages/pty-daemon/dist' },
  ])
  expect(Object.keys(pkg.exports)).toEqual(['./contract', './main', './renderer'])
  expect(daemonPkg.name).toBe('@pragma/terminal-pty-daemon')
  expect(daemonPkg.dependencies['node-pty']).toBe('1.1.0')
})

test('locale has module name', () => expect(en.module.name).toBe('Terminal'))
