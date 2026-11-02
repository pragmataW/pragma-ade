import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  analyzeBundle,
  assertNoWorkspaceExternals,
  BundleError,
  packageNameOf,
  scanSpecifiers,
} from '../lib/externals.ts'
import { makeRepo, pkg } from './support/repo.ts'

const STORE = 'node_modules/.pnpm/better-sqlite3@13.0.3/node_modules/better-sqlite3'
const REL_ENTRY = `../../../../${STORE}/lib/index.js`
const sqlite = (version = '13.0.3') => pkg('better-sqlite3', undefined, { version, main: 'lib/index.js' })
const desktop = (files: Record<string, string | object>) => {
  const root = makeRepo({ [`${STORE}/package.json`]: sqlite(), [`${STORE}/lib/index.js`]: '', ...files })
  return { root, out: join(root, 'apps/desktop/out'), app: join(root, 'apps/desktop') }
}

describe('packageNameOf', () => {
  it.each([
    ['fs', null],
    ['node:path', null],
    ['fs/promises', null],
    ['electron', null],
    ['electron/main', null],
    ['./x', null],
    ['/abs', null],
    ['data:text/javascript,1', null],
    ['better-sqlite3', 'better-sqlite3'],
    ['@parcel/watcher', '@parcel/watcher'],
    ['@xterm/headless/lib/x', '@xterm/headless'],
  ])('%s → %s', (spec, name) => expect(packageNameOf(spec)).toBe(name))
})

it('scans all import forms', () => {
  const root = makeRepo({
    'a.js':
      'const a = require("a")\nimport x from \'@s/b\'\nawait import("c")\nimport "./side.js"\nconst t = `$' +
      '{require("d")}`\n',
  })
  expect(scanSpecifiers([join(root, 'a.js')]).map((h) => h.specifier)).toEqual(['a', 'd', 'c', '@s/b', './side.js'])
})

describe('analyzeBundle', () => {
  it('rewrites relative node_modules specifiers to bare', () => {
    const { out } = desktop({
      'apps/desktop/out/main/index.js': `import Db from "${REL_ENTRY}"\nimport x from "${REL_ENTRY.replace('index.js', 'x.js')}"\nimport "./chunk.js"\n`,
      [`${STORE}/lib/x.js`]: '',
      'apps/desktop/out/main/chunk.js': '',
    })
    const scan = analyzeBundle(out, [])
    expect(scan.rewrites.map((r) => r.to)).toEqual(['better-sqlite3', 'better-sqlite3/lib/x.js'])
    expect(scan.externals).toMatchObject([{ name: 'better-sqlite3', version: '13.0.3' }])
  })
  it('bare external resolved from searchDirs', () => {
    const { out, app } = desktop({
      'apps/desktop/node_modules/better-sqlite3/package.json': sqlite(),
      'apps/desktop/out/main/index.js': 'import Db from "better-sqlite3"\n',
    })
    expect(analyzeBundle(out, [app]).externals).toMatchObject([{ name: 'better-sqlite3', subpath: '' }])
  })
  it('skipDirs leaves the renderer bundle out', () => {
    const { out } = desktop({
      'apps/desktop/out/main/index.js': '',
      'apps/desktop/out/renderer/index.js': 'import x from "unified"\n',
    })
    expect(analyzeBundle(out, [], { skipDirs: ['renderer'] }).unresolved).toEqual([])
  })
  it('unresolved bare is reported, not thrown', () => {
    const { out } = desktop({ 'apps/desktop/out/main/index.js': 'try { require("bufferutil") } catch {}\n' })
    expect(analyzeBundle(out, [])).toMatchObject({ externals: [], unresolved: ['bufferutil'] })
  })
  it('conflicting versions throw', () => {
    const { out, app } = desktop({
      'apps/desktop/node_modules/better-sqlite3/package.json': sqlite('12.0.0'),
      'apps/desktop/out/main/index.js': `import a from "better-sqlite3"\nimport b from "${REL_ENTRY}"\n`,
    })
    expect(() => analyzeBundle(out, [app])).toThrow(/Conflicting versions for better-sqlite3/)
  })
  it('import of repo source outside out/ throws BundleError', () => {
    const { out } = desktop({
      'apps/desktop/src/x.js': '',
      'apps/desktop/out/main/index.js': 'import x from "../../src/x.js"\n',
    })
    expect(() => analyzeBundle(out, [])).toThrow(BundleError)
  })
  it('@pragma external throws', () => {
    const { out, app } = desktop({
      'apps/desktop/node_modules/@pragma/sdk/package.json': pkg('@pragma/sdk'),
      'apps/desktop/out/main/index.js': 'import x from "@pragma/sdk"\n',
    })
    expect(() => assertNoWorkspaceExternals(analyzeBundle(out, [app]))).toThrow(BundleError)
  })
})
