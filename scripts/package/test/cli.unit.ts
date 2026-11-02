import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseArgs } from '../cli.ts'
import { mkTemp } from '../lib/fsx.ts'
import { exitCodeFor, readManifest, writeManifest } from '../lib/report.ts'
import { type DistManifest, DistManifestSchema, type TargetReport } from '../lib/schema.ts'
import { TARGET_IDS } from '../lib/targets.ts'

const report = (status: TargetReport['status']): TargetReport => ({
  status,
  artifacts: [],
  externals: [],
  resources: [],
  natives: [{ name: 'node-pty', version: '1.1.0', source: 'prebuilt', files: [] }],
  warnings: [],
})
const manifest = (over: Partial<DistManifest> = {}): DistManifest => ({
  generatedAt: '2026-11-02T00:00:00.000Z',
  repoCommit: null,
  appVersion: '0.1.0',
  electronVersion: '45.2.1',
  electronBuilderVersion: '26.18.0',
  targets: { 'darwin-arm64': report('ok') },
  unpackagedBuilds: [],
  warnings: [],
  ...over,
})

it('parseArgs all → every target, deep', () =>
  expect(parseArgs(['all'])).toMatchObject({ command: 'all', targets: [...TARGET_IDS], deep: true }))

describe('exitCodeFor', () => {
  it.each<[string, Partial<DistManifest>, number]>([
    ['ok', {}, 0],
    ['a failed target', { targets: { 'darwin-arm64': report('failed') } }, 1],
    ['unpackaged builds', { unpackagedBuilds: [{ ownerId: 'terminal', packageName: 'pty' }] }, 2],
    ['smoke skipped', { smoke: { passed: 1, failed: 0, skipped: [{ title: 't', reason: 'r' }], failures: [] } }, 2],
    ['smoke failed', { smoke: { passed: 1, failed: 1, skipped: [], failures: [] } }, 1],
  ])('%s → %i', (_name, over, code) => expect(exitCodeFor(manifest(over), ['darwin-arm64'])).toBe(code))
  it('a requested target that was not built fails', () =>
    expect(exitCodeFor(manifest(), ['darwin-arm64', 'linux-x64'])).toBe(1))
})

describe('writeManifest', () => {
  it('writeManifest merges previous targets', () => {
    const dist = mkTemp('dist root')
    writeManifest(dist, manifest())
    writeManifest(dist, manifest({ targets: { 'linux-x64': report('failed') } }))
    expect(Object.keys(readManifest(dist)?.targets ?? {}).sort()).toEqual(['darwin-arm64', 'linux-x64'])
    expect(readFileSync(join(dist, 'SUMMARY.md'), 'utf8')).toMatch(/\| linux-x64 \| \*\*failed\*\*/)
  })
  it('manifest validates against DistManifestSchema', () => {
    const dist = mkTemp('dist root')
    writeManifest(dist, manifest())
    expect(existsSync(join(dist, 'manifest.json'))).toBe(true)
    expect(() => DistManifestSchema.parse(JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8')))).not.toThrow()
  })
})
