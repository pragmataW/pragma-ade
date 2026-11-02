import { describe, expect, it } from 'vitest'
import { PINNED_RELEASE, resolveAsset } from '../src/main/release/release'

const HEX64 = /^[0-9a-f]{64}$/

describe('pinned release', () => {
  it('resolveAsset darwin arm64', () => {
    expect(resolveAsset(PINNED_RELEASE, 'darwin', 'arm64')).toMatchObject({
      key: 'darwin-arm64',
      url: 'https://github.com/VSCodium/vscodium/releases/download/1.143.17232/vscodium-reh-web-darwin-arm64-1.143.17232.tar.gz',
      sha256: '2a33e8d5c39cad9a1f6c81a56c908367a60738f08ff72304ff42b62652c41b01',
    })
  })

  it('resolveAsset win32 arm64 is unsupported', () => {
    expect(resolveAsset(PINNED_RELEASE, 'win32', 'arm64')).toEqual({ error: 'unsupportedPlatform' })
  })

  it('every asset sha256 is 64 lowercase hex and file contains version', () => {
    for (const a of Object.values(PINNED_RELEASE.assets)) {
      expect(a.sha256).toMatch(HEX64)
      expect(a.file).toContain(PINNED_RELEASE.version)
      expect(a.sizeBytes).toBeGreaterThan(0)
    }
  })
})
