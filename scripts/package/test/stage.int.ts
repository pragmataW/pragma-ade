import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { walkFiles } from '../lib/fsx.ts'
import { stageTarget } from '../lib/stage.ts'
import { TARGETS, type TargetId } from '../lib/targets.ts'
import type { ResourceDecl } from '../lib/workspace.ts'
import { useTempCache } from './support/cache.ts'
import { makeRepo, pkg } from './support/repo.ts'

useTempCache('stage root')

const WATCHER_REL = '../../../../node_modules/@parcel/watcher/index.js'
/** A repo whose desktop bundle imports @parcel/watcher relatively and a daemon resource that requires node-pty. */
function fixture(): { repo: string; resources: ResourceDecl[] } {
  const repo = makeRepo(
    {
      'node_modules/@parcel/watcher/package.json': pkg('@parcel/watcher', undefined, {
        version: '2.6.0',
        main: 'index.js',
      }),
      'node_modules/@parcel/watcher/index.js': '',
      'apps/desktop/out/main/index.js': `import w from "${WATCHER_REL}"\nexport default w\n`,
      'apps/desktop/out/renderer/index.html': '<!doctype html>',
      'modules/terminal/package.json': pkg('@pragma/module-terminal', { id: 'terminal' }, { type: 'module' }),
      'modules/terminal/node_modules/node-pty/package.json': pkg('node-pty', undefined, { version: '1.1.0' }),
      'modules/terminal/dist/pty-daemon.cjs': 'require("node-pty")\n',
    },
    'stage root',
  )
  const resources: ResourceDecl[] = [
    {
      ownerId: 'terminal',
      declaredBy: join(repo, 'modules/terminal'),
      fromAbs: join(repo, 'modules/terminal/dist'),
      to: 'dist',
      dest: 'modules/terminal/dist',
    },
  ]
  return { repo, resources }
}

const stage = (target: TargetId, f = fixture()) =>
  stageTarget({
    target: TARGETS[target],
    desktopDir: join(f.repo, 'apps/desktop'),
    desktopPkg: { name: '@pragma/desktop', version: '0.1.0', type: 'module', main: 'out/main/index.js' },
    productName: 'Pragma ADE',
    resources: f.resources,
    searchDirs: [],
  })
const scoped = (appDir: string, scope: string): string[] => readdirSync(join(appDir, 'node_modules', scope))

describe('stageTarget (npm, network)', () => {
  it('win32 install picks @parcel/watcher-win32-x64', async () => {
    const r = await stage('win32-x64')
    const parcel = scoped(r.appDir, '@parcel')
    expect(parcel).toContain('watcher-win32-x64')
    expect(parcel.filter((n) => n.includes('darwin'))).toEqual([])
  })
  it('linux install picks glibc not musl', async () => {
    const r = await stage('linux-x64')
    const parcel = scoped(r.appDir, '@parcel')
    expect(parcel).toContain('watcher-linux-x64-glibc')
    expect(parcel.filter((n) => n.includes('musl'))).toEqual([])
  })
  it('stageTarget wipes the previous stage', async () => {
    const first = await stage('darwin-arm64')
    const sentinel = join(first.stageRoot, 'sentinel')
    writeFileSync(sentinel, '')
    await stage('darwin-arm64')
    expect(existsSync(sentinel)).toBe(false)
  })
  it('staged resource package.json keeps type and node-pty is executable', async () => {
    const r = await stage('darwin-arm64')
    const dir = join(r.resourcesDir, 'modules/terminal/dist')
    expect(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).type).toBe('module')
    const pty = join(dir, 'node_modules/node-pty')
    expect(statSync(join(pty, 'prebuilds/darwin-arm64/spawn-helper')).mode & 0o777).toBe(0o755)
    expect(existsSync(join(pty, 'prebuilds/win32-x64'))).toBe(false)
    expect(existsSync(join(dir, 'package-lock.json'))).toBe(false)
  })
  it('staged bundle has no ../node_modules specifier', async () => {
    const r = await stage('darwin-arm64')
    const hits = walkFiles(join(r.appDir, 'out')).filter((f) => readFileSync(f, 'utf8').includes('/node_modules/'))
    expect(hits).toEqual([])
    expect(readFileSync(join(r.appDir, 'out/main/index.js'), 'utf8')).toContain('"@parcel/watcher"')
  })
})
