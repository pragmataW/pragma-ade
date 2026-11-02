import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ensureNatives,
  findNativePackages,
  isSatisfied,
  NativeUnavailableError,
  nativeCacheKey,
} from '../lib/natives.ts'
import { TARGETS } from '../lib/targets.ts'
import { elfHeader, machoHeader, peHeader, writeBinary } from './support/binaries.ts'
import { useTempCache } from './support/cache.ts'
import { makeRepo, pkg } from './support/repo.ts'

const cache = useTempCache('natives root')
const NO_DOCKER = { electronVersion: '45.2.1', dockerAutoStart: false }
const repo = (files: Record<string, string | object>) => makeRepo(files, 'natives root')

describe('findNativePackages', () => {
  it.each([
    ['binding.gyp', { 'node_modules/a/binding.gyp': '' }],
    ['prebuilds', { 'node_modules/a/prebuilds/.keep': '' }],
    ['.node', { 'node_modules/a/lib/x.node': '' }],
  ])('detects native by %s', async (_marker, files) => {
    const root = repo({
      'node_modules/a/package.json': pkg('a'),
      'node_modules/plain/package.json': pkg('plain'),
      ...files,
    })
    expect((await findNativePackages(root, TARGETS['linux-x64'])).map((p) => p.name)).toEqual(['a'])
  })
  it('optional dependency satisfies parent', async () => {
    const root = repo({
      'node_modules/@parcel/watcher/package.json': pkg('@parcel/watcher', undefined, {
        optionalDependencies: { '@parcel/watcher-linux-x64-glibc': '2.6.0' },
      }),
      'node_modules/@parcel/watcher/binding.gyp': '',
      'node_modules/@parcel/watcher-linux-x64-glibc/package.json': pkg('@parcel/watcher-linux-x64-glibc'),
    })
    writeBinary(join(root, 'node_modules/@parcel/watcher-linux-x64-glibc/watcher.node'), elfHeader('x64'))
    const all = await findNativePackages(root, TARGETS['linux-x64'])
    expect(all.every((p) => isSatisfied(p, all))).toBe(true)
  })
  it('foreign .node is reported, not satisfied', async () => {
    const root = repo({ 'node_modules/a/package.json': pkg('a') })
    writeBinary(join(root, 'node_modules/a/build/Release/a.node'), machoHeader('arm64'))
    const [a] = await findNativePackages(root, TARGETS['linux-x64'])
    expect(a?.foreign).toHaveLength(1)
    expect(a && isSatisfied(a, [a])).toBe(false)
  })
})

describe('ensureNatives', () => {
  it('cache hit avoids compile', async () => {
    const root = repo({ 'node_modules/a/package.json': pkg('a'), 'node_modules/a/binding.gyp': '' })
    const key = nativeCacheKey('a', '1.0.0', TARGETS['win32-x64'], '45.2.1')
    writeBinary(join(cache.dir(), 'natives', key, 'a.node'), peHeader('x64', { dll: true }))
    const [r] = await ensureNatives(root, TARGETS['win32-x64'], NO_DOCKER)
    expect(r?.source).toBe('cache')
    expect(existsSync(join(root, 'node_modules/a/build/Release/a.node'))).toBe(true)
  })
  it('win32 without prebuild throws NativeUnavailableError', async () => {
    const root = repo({ 'node_modules/b/package.json': pkg('b'), 'node_modules/b/binding.gyp': '' })
    const error = await ensureNatives(root, TARGETS['win32-x64'], NO_DOCKER).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(NativeUnavailableError)
    expect(String(error)).toMatch(/cannot be compiled on macOS/)
    expect(String(error)).toContain(join(cache.dir(), 'natives'))
  })
})

it('nativeCacheKey', () =>
  expect(nativeCacheKey('@a/b', '1.0.0', TARGETS['linux-x64'], '45.2.1')).toBe('@a+b@1.0.0-linux-x64-electron45.2.1'))

it('a loader whose optional dependency is native counts as native', async () => {
  const root = repo({
    'node_modules/@parcel/watcher/package.json': pkg('@parcel/watcher', undefined, {
      optionalDependencies: { '@parcel/watcher-darwin-arm64': '2.6.0' },
    }),
    'node_modules/@parcel/watcher-darwin-arm64/package.json': pkg('@parcel/watcher-darwin-arm64'),
  })
  writeBinary(join(root, 'node_modules/@parcel/watcher-darwin-arm64/watcher.node'), machoHeader('arm64'))
  const all = await findNativePackages(root, TARGETS['darwin-arm64'])
  expect(all.map((p) => p.name).sort()).toEqual(['@parcel/watcher', '@parcel/watcher-darwin-arm64'])
  expect(all.every((p) => isSatisfied(p, all))).toBe(true)
})
