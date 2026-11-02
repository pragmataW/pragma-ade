import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { extractInstall, INSTALL_MARKER, isInstalled } from '../src/main/install/extract'
import { tempDir } from './support/httpFixture'
import { FAKE_BIN, makeFakeArchive } from './support/makeFakeArchive'

const tmp = tempDir()
afterAll(() => tmp.cleanup())
const opts = (strip = 0) => ({ stripComponents: strip, binRelPath: FAKE_BIN, version: '1.0.0', sha256: 'abc' })

describe('extractInstall', () => {
  it('extracts, keeps exec bit on bin, writes marker', async () => {
    const archive = join(tmp.dir, 'a.tar.gz')
    await makeFakeArchive(archive)
    const target = join(tmp.dir, 'install-a')
    expect(await extractInstall(archive, target, opts())).toEqual({ ok: true })
    expect(statSync(join(target, FAKE_BIN)).mode & 0o111).not.toBe(0)
    expect(existsSync(join(target, INSTALL_MARKER))).toBe(true)
    expect(await isInstalled(target, '1.0.0', FAKE_BIN)).toBe(true)
    expect(await isInstalled(target, '2.0.0', FAKE_BIN)).toBe(false)
  })

  it('stripComponents 1 handles root-folder archives', async () => {
    const archive = join(tmp.dir, 'b.tar.gz')
    await makeFakeArchive(archive, { rootFolder: 'vscodium-reh-web' })
    const target = join(tmp.dir, 'install-b')
    expect(await extractInstall(archive, target, opts(1))).toEqual({ ok: true })
    expect(existsSync(join(target, FAKE_BIN))).toBe(true)
  })

  it('missing bin → invalidArchive and no installDir', async () => {
    const archive = join(tmp.dir, 'c.tar.gz')
    await makeFakeArchive(archive, { withBin: false })
    const target = join(tmp.dir, 'install-c')
    expect(await extractInstall(archive, target, opts())).toMatchObject({ ok: false, reason: 'invalidArchive' })
    expect(existsSync(target)).toBe(false)
  })
})
