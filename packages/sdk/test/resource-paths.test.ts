import { expect, it, test } from 'vitest'
import { createResourcePaths, PathEscapeError, UnknownModuleError } from '../src/runtime/main/resource-paths'

const modules = new Map([
  [
    'm',
    {
      dir: '/r/modules/m',
      extraResources: [
        { from: '/r/modules/m/build-output', to: 'assets' },
        { from: '/r/modules/m/dist/bin', to: 'assets/bin' },
        { from: '/r/modules/m/packages/d/dist/d.js', to: 'bin/d.js' },
      ],
    },
  ],
])
const dev = createResourcePaths({ isPackaged: false, resourcesPath: '/res', modules })
const packaged = createResourcePaths({ isPackaged: true, resourcesPath: '/res', modules })

it.each([
  ['assets/x.txt', '/r/modules/m/build-output/x.txt', '/res/modules/m/assets/x.txt'],
  ['assets/bin/cli', '/r/modules/m/dist/bin/cli', '/res/modules/m/assets/bin/cli'],
  ['locales/en.json', '/r/modules/m/locales/en.json', '/res/modules/m/locales/en.json'],
  ['assetsX/y', '/r/modules/m/assetsX/y', '/res/modules/m/assetsX/y'],
  ['bin/d.js', '/r/modules/m/packages/d/dist/d.js', '/res/modules/m/bin/d.js'],
])('resource(m, %s)', (rel, devPath, packagedPath) => {
  expect(dev.resource('m', rel)).toBe(devPath)
  expect(packaged.resource('m', rel)).toBe(packagedPath)
})
test('resource rejects ../ escape in rel and in to', () => {
  expect(() => dev.resource('m', '../x')).toThrow(PathEscapeError)
  const bad = createResourcePaths({
    isPackaged: false,
    resourcesPath: '/res',
    modules: new Map([['b', { dir: '/r/b', extraResources: [{ from: '/r/b/x', to: '../up' }] }]]),
  })
  expect(() => bad.resource('b', 'x')).toThrow(PathEscapeError)
})
test('unknown module throws', () => expect(() => dev.resource('zz', 'a')).toThrow(UnknownModuleError))
