import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { computeConfig, loadBaseConfig } from '../lib/builder.ts'
import { mkTemp } from '../lib/fsx.ts'
import { TARGETS } from '../lib/targets.ts'
import { makeRepo } from './support/repo.ts'

const REPO = resolve(import.meta.dirname, '../../..')
const base = loadBaseConfig(REPO)
const ctx = (resourcesDir: string) => ({
  repoRoot: REPO,
  target: TARGETS['darwin-arm64'],
  appDir: '/stage/app',
  resourcesDir,
  outputDir: '/dist/darwin-arm64',
  electronVersion: '45.2.1',
  nativePackageNames: ['better-sqlite3', '@parcel/watcher'],
})
const withResources = makeRepo({ 'modules/terminal/x': '' }, 'builder root')
const empty = mkTemp('builder root')

describe('computeConfig', () => {
  it('computeConfig sets absolute directories and electronVersion', () => {
    const c = computeConfig(base, ctx(withResources))
    expect(c.directories).toEqual({
      app: '/stage/app',
      output: '/dist/darwin-arm64',
      buildResources: join(REPO, 'build'),
    })
    expect(c.electronVersion).toBe('45.2.1')
    expect((c.mac as { icon: string }).icon).toBe(join(REPO, 'build/icon.png'))
  })
  it('asarUnpack lists native packages', () =>
    expect(computeConfig(base, ctx(empty)).asarUnpack).toEqual([
      '**/*.node',
      'node_modules/better-sqlite3/**',
      'node_modules/@parcel/watcher/**',
    ]))
  it('extraResources only when the resources dir has content', () => {
    expect(computeConfig(base, ctx(empty)).extraResources).toBeUndefined()
    expect(computeConfig(base, ctx(withResources)).extraResources).toEqual([
      { from: withResources, to: '.', filter: ['**/*'] },
    ])
  })
  it('base keys survive', () => {
    const c = computeConfig(base, ctx(empty))
    expect(c.appId).toBe('dev.pragma.ade')
    expect((c.mac as { identity: string }).identity).toBe('-')
    expect((c.win as { signExecutable: boolean }).signExecutable).toBe(false)
    expect(c.publish).toBeNull()
  })
})
