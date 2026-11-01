import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { EditorStatus } from '../src/contract'
import { INSTALL_MARKER } from '../src/main/install/extract'
import { EditorInstaller, type InstallerDeps } from '../src/main/install/installer'
import { FAKE_FILE, FAKE_VERSION, fakeRelease } from './support/factories'
import { type HttpFixture, sha256Of, startHttpFixture, tempDir } from './support/httpFixture'
import { makeFakeArchive } from './support/makeFakeArchive'

const tmp = tempDir()
let archive: Buffer
let http: HttpFixture
let n = 0

beforeAll(async () => {
  archive = await makeFakeArchive(join(tmp.dir, 'src.tar.gz'), { paddingBytes: 256 * 1024 })
  http = await startHttpFixture(archive, { chunk: 16 * 1024, delayMs: 20 })
})
afterAll(async () => {
  await http.close()
  tmp.cleanup()
})

/** A fresh userData; `route` picks the fixture path the asset is served from. */
function installer(o: { route?: string; sha?: string; extra?: Partial<InstallerDeps> } = {}) {
  const userDataDir = join(tmp.dir, `ud-${++n}`)
  mkdirSync(userDataDir)
  const route = o.route ?? 'file'
  // the fixture serves the archive at /file and /slow; FAKE_FILE is appended to baseUrl
  const fetchImpl: typeof fetch = (input, init) => fetch(String(input).replace(`/${FAKE_FILE}`, `/${route}`), init)
  const release = fakeRelease({ baseUrl: http.url('/'), sha256: o.sha ?? sha256Of(archive), sizeBytes: archive.length })
  const inst = new EditorInstaller({
    userDataDir,
    release,
    platform: process.platform,
    arch: process.arch,
    fetchImpl,
    ...o.extra,
  })
  const states: EditorStatus['state'][] = []
  inst.onStatus((s) => {
    if (states.at(-1) !== s.state) states.push(s.state)
  })
  return { inst, userDataDir, states }
}

describe('EditorInstaller', () => {
  it('status sequence not-installed→downloading→verifying→extracting→(resolved)', async () => {
    const { inst, states } = installer({ route: 'slow' })
    expect(inst.status().state).toBe('not-installed')
    const s = await inst.ensureInstalled()
    expect(s.state).toBe('starting')
    expect(states).toEqual(['downloading', 'verifying', 'extracting', 'starting'])
    expect(existsSync(join(inst.installDir, INSTALL_MARKER))).toBe(true)
  })

  it('ignores install dir without marker', async () => {
    const { inst, states } = installer()
    mkdirSync(inst.installDir, { recursive: true })
    writeFileSync(join(inst.installDir, 'junk'), 'x')
    expect((await inst.ensureInstalled()).state).toBe('starting')
    expect(states).toContain('downloading')
    expect(existsSync(join(inst.installDir, 'junk'))).toBe(false)
  })

  it('checksum mismatch → error editor:errors.checksumMismatch retryable, installDir absent', async () => {
    const { inst } = installer({ sha: '0'.repeat(64) })
    expect(await inst.ensureInstalled()).toMatchObject({
      state: 'error',
      errorKey: 'editor:errors.checksumMismatch',
      retryable: true,
    })
    expect(existsSync(inst.installDir)).toBe(false)
  })

  it.each([
    ['used when sha matches', true],
    ['ignored when not', false],
  ])('downloadCacheDir copy is %s', async (_label, matching) => {
    const cacheDir = join(tmp.dir, `cache-${++n}`)
    mkdirSync(cacheDir)
    writeFileSync(join(cacheDir, FAKE_FILE), matching ? archive : Buffer.from('corrupt'))
    const { inst, states } = installer({ extra: { downloadCacheDir: cacheDir } })
    expect((await inst.ensureInstalled()).state).toBe('starting')
    expect(states.includes('downloading')).toBe(!matching)
  })

  it('cancel during download → not-installed, later ensureInstalled succeeds', async () => {
    const { inst } = installer({ route: 'slow' })
    inst.onStatus((s) => {
      if (s.state === 'downloading' && s.received > 0) inst.cancel()
    })
    expect((await inst.ensureInstalled()).state).toBe('not-installed')
    const again = installer().inst
    expect((await again.ensureInstalled()).state).toBe('starting')
  })

  it('concurrent ensureInstalled calls download once', async () => {
    const { inst, states } = installer({ route: 'slow' })
    const [a, b] = await Promise.all([inst.ensureInstalled(), inst.ensureInstalled()])
    expect(a).toBe(b)
    expect(states.filter((s) => s === 'downloading')).toHaveLength(1)
  })

  it('removes older version dirs after success', async () => {
    const { inst, userDataDir } = installer()
    const old = join(userDataDir, 'editor', '0.0.0-old')
    mkdirSync(old, { recursive: true })
    writeFileSync(join(old, INSTALL_MARKER), JSON.stringify({ version: '0.0.0-old' }))
    const keep = join(userDataDir, 'editor', 'extensions')
    mkdirSync(keep, { recursive: true })
    await inst.ensureInstalled()
    expect(existsSync(old)).toBe(false)
    expect(existsSync(keep)).toBe(true)
    expect(existsSync(join(userDataDir, 'editor', 'downloads'))).toBe(false)
    expect(inst.installDir).toBe(join(userDataDir, 'editor', FAKE_VERSION))
  })

  it('unsupported platform → error not retryable', async () => {
    const { inst } = installer({ extra: { arch: 'mips' } })
    expect(await inst.ensureInstalled()).toMatchObject({ state: 'error', retryable: false })
  })
})
