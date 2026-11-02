import { chmodSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { auditTree } from '../lib/audit.ts'
import { loadAsar } from '../lib/deps.ts'
import { mkTemp } from '../lib/fsx.ts'
import { TARGETS } from '../lib/targets.ts'
import { elfHeader, machoHeader, writeBinary } from './support/binaries.ts'
import { writeTree } from './support/repo.ts'

const T = TARGETS['darwin-arm64']
const EXP = {
  productName: 'Pragma ADE',
  executableName: 'pragma-ade',
  resourceDests: ['modules/terminal/pty-daemon'],
  nativePackages: ['better-sqlite3', 'node-pty'],
  main: 'out/main/index.js',
}
const RES = 'Pragma ADE.app/Contents/Resources'
const PTY = `${RES}/modules/terminal/pty-daemon/node_modules/node-pty`

/** A packaged-looking darwin-arm64 tree below a path with spaces; `asarFiles` go into app.asar. */
async function tree(asarFiles: Record<string, string> = {}): Promise<string> {
  const root = mkTemp('audit root')
  const asarSrc = writeTree(mkTemp('audit root'), { 'package.json': '{}', 'out/main/index.js': '', ...asarFiles })
  writeTree(root, {
    [`${RES}/app.asar.unpacked/node_modules/better-sqlite3/package.json`]: {
      name: 'better-sqlite3',
      version: '13.0.3',
    },
    [`${PTY}/package.json`]: { name: 'node-pty', version: '1.1.0' },
  })
  await (await loadAsar()).createPackage(asarSrc, join(root, RES, 'app.asar'))
  writeBinary(join(root, 'Pragma ADE.app/Contents/MacOS/Pragma ADE'), machoHeader('arm64', { exec: true }), 0o755)
  writeBinary(
    join(root, `${RES}/app.asar.unpacked/node_modules/better-sqlite3/build/Release/b.node`),
    machoHeader('arm64'),
  )
  writeBinary(join(root, `${PTY}/prebuilds/darwin-arm64/pty.node`), machoHeader('arm64'))
  writeBinary(join(root, `${PTY}/prebuilds/darwin-arm64/spawn-helper`), machoHeader('arm64', { exec: true }), 0o755)
  return root
}
const failing = async (root: string) => (await auditTree(root, T, EXP)).checks.filter((c) => !c.ok).map((c) => c.id)

describe('auditTree', () => {
  it('clean tree under a path with spaces is ok', async () => {
    const r = await auditTree(await tree(), T, EXP)
    expect(r.checks.filter((c) => !c.ok)).toEqual([])
    expect(r.nativeFiles).toHaveLength(2)
  })
  it.each<[string, (root: string) => void, string]>([
    ['foreign binary', (root) => writeBinary(join(root, `${RES}/x.so`), elfHeader('x64')), 'binaries.arch'],
    [
      'missing native',
      (root) => rmSync(join(root, `${RES}/app.asar.unpacked/node_modules/better-sqlite3`), { recursive: true }),
      'natives.present',
    ],
    [
      'spawn-helper 0644 on darwin',
      (root) => chmodSync(join(root, `${PTY}/prebuilds/darwin-arm64/spawn-helper`), 0o644),
      'exec-bit',
    ],
    [
      'missing resource',
      (root) => rmSync(join(root, `${RES}/modules/terminal`), { recursive: true }),
      'resources.present',
    ],
  ])('%s fails %s', async (_name, mutate, id) => {
    const root = await tree()
    mutate(root)
    expect(await failing(root)).toContain(id)
  })
  it('.node inside asar fails natives.unpacked', async () => {
    expect(await failing(await tree({ 'node_modules/x/x.node': 'x' }))).toContain('natives.unpacked')
  })
})
