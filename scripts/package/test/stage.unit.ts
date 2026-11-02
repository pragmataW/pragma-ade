import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyRewrites, fixExecutableBits, pruneForTarget, StageError, stageTarget } from '../lib/stage.ts'
import { TARGETS, type TargetId } from '../lib/targets.ts'
import type { ResourceDecl } from '../lib/workspace.ts'
import { machoHeader, writeBinary } from './support/binaries.ts'
import { useTempCache } from './support/cache.ts'
import { makeRepo, writeTree } from './support/repo.ts'

useTempCache('stage root')

const SQLITE = ['darwin-arm64.node', 'linux-x64.node', 'linuxmusl-x64.node', 'win32-x64.node']
const nodeModules = () =>
  join(
    writeTree(makeRepo({}, 'stage root'), {
      ...Object.fromEntries(SQLITE.map((f) => [`node_modules/better-sqlite3/prebuilds/${f}`, ''])),
      'node_modules/better-sqlite3/package.json': { name: 'better-sqlite3' },
      'node_modules/@parcel/watcher/package.json': { name: '@parcel/watcher' },
      'node_modules/@parcel/watcher/prebuilds/darwin-x64+arm64/w.node': '',
      'node_modules/@parcel/watcher/prebuilds/linux-x64/node.napi.glibc.node': '',
      'node_modules/node-pty/package.json': { name: 'node-pty' },
      'node_modules/node-pty/third_party/conpty/1.23/win10-x64/conpty.dll': '',
      'node_modules/node-pty/third_party/conpty/1.23/win10-arm64/conpty.dll': '',
    }),
    'node_modules',
  )

describe('pruneForTarget', () => {
  it.each<[TargetId, string[], string[]]>([
    [
      'linux-x64',
      ['better-sqlite3/prebuilds/linux-x64.node', '@parcel/watcher/prebuilds/linux-x64/node.napi.glibc.node'],
      ['better-sqlite3/prebuilds/linuxmusl-x64.node', 'node-pty/third_party'],
    ],
    [
      'darwin-x64',
      ['@parcel/watcher/prebuilds/darwin-x64+arm64/w.node'],
      ['better-sqlite3/prebuilds/darwin-arm64.node', 'node-pty/third_party'],
    ],
    [
      'darwin-arm64',
      ['better-sqlite3/prebuilds/darwin-arm64.node', '@parcel/watcher/prebuilds/darwin-x64+arm64'],
      ['better-sqlite3/prebuilds/linux-x64.node'],
    ],
    [
      'win32-x64',
      ['better-sqlite3/prebuilds/win32-x64.node', 'node-pty/third_party/conpty/1.23/win10-x64'],
      ['node-pty/third_party/conpty/1.23/win10-arm64', 'better-sqlite3/prebuilds/darwin-arm64.node'],
    ],
  ])('%s', (target, kept, removed) => {
    const nm = nodeModules()
    pruneForTarget(nm, TARGETS[target])
    for (const k of kept) expect(existsSync(join(nm, k)), k).toBe(true)
    for (const r of removed) expect(existsSync(join(nm, r)), r).toBe(false)
  })
})

describe('fixExecutableBits', () => {
  it('fixExecutableBits sets 0755', async () => {
    const root = makeRepo({}, 'stage root')
    const helper = writeBinary(
      join(root, 'node-pty/prebuilds/darwin-arm64/spawn-helper'),
      machoHeader('arm64', { exec: true }),
    )
    const lib = writeBinary(join(root, 'node-pty/prebuilds/darwin-arm64/pty.node'), machoHeader('arm64'))
    expect(await fixExecutableBits(root, TARGETS['darwin-arm64'])).toEqual([helper])
    expect(statSync(helper).mode & 0o777).toBe(0o755)
    expect(statSync(lib).mode & 0o777).toBe(0o644)
  })
  it('fixExecutableBits is a no-op for win32', async () => {
    const root = makeRepo({}, 'stage root')
    writeBinary(join(root, 'spawn-helper'), machoHeader('x64', { exec: true }))
    expect(await fixExecutableBits(root, TARGETS['win32-x64'])).toEqual([])
  })
})

it('applyRewrites replaces only quoted exact specifiers', () => {
  const from = makeRepo({ 'a.js': `require("../x/y.js"); require('../x/y.js'); "../x/y.jsx"; ../x/y.js` }, 'stage root')
  const to = makeRepo({ 'a.js': readFileSync(join(from, 'a.js'), 'utf8') }, 'stage root')
  applyRewrites([{ file: join(from, 'a.js'), from: '../x/y.js', to: 'y' }], from, to)
  expect(readFileSync(join(to, 'a.js'), 'utf8')).toBe(`require("y"); require('y'); "../x/y.jsx"; ../x/y.js`)
})

describe('stageTarget resources', () => {
  const stage = (repo: string, resources: ResourceDecl[]) =>
    stageTarget({
      target: TARGETS['darwin-arm64'],
      desktopDir: join(repo, 'apps/desktop'),
      desktopPkg: { name: '@pragma/desktop', version: '0.1.0', type: 'module', main: 'out/main/index.js' },
      productName: 'Pragma ADE',
      resources,
      searchDirs: [],
    })
  const decl = (repo: string, from: string, to: string, ownerId = 'editor'): ResourceDecl => ({
    ownerId,
    declaredBy: join(repo, 'modules', ownerId),
    fromAbs: join(repo, 'modules', ownerId, from),
    to,
    dest: `modules/${ownerId}/${to}`,
  })
  const repoWith = (files: Record<string, string>) =>
    makeRepo({ 'apps/desktop/out/main/index.js': '', ...files }, 'stage root')

  it('missing extraResources source throws StageError naming the package', async () => {
    const repo = repoWith({})
    await expect(stage(repo, [decl(repo, 'dist', 'dist')])).rejects.toThrow(StageError)
    await expect(stage(repo, [decl(repo, 'dist', 'dist')])).rejects.toThrow(/modules\/editor/)
  })
  it('file resource is copied to exactly to', async () => {
    const repo = repoWith({ 'modules/editor/dist/pragma-bridge.vsix': 'zip' })
    const r = await stage(repo, [decl(repo, 'dist/pragma-bridge.vsix', 'pragma-bridge.vsix')])
    const dest = join(r.resourcesDir, 'modules/editor/pragma-bridge.vsix')
    expect(statSync(dest).isFile()).toBe(true)
    expect(r.resources.map((x) => x.dest)).toEqual(['modules/editor/pragma-bridge.vsix'])
  })
})
