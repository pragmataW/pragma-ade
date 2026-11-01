import { z } from '@pragma/sdk'
import {
  ARCHIVE_STRIP_COMPONENTS,
  ASSET_KEY_SEPARATOR,
  PINNED_VERSION,
  RELEASE_BASE_URL,
  SERVER_BIN,
  UNSUPPORTED_PLATFORM,
} from '../../constants'

export const ReleaseAssetSchema = z.object({ file: z.string(), sha256: z.string(), sizeBytes: z.number() })
export type ReleaseAsset = z.infer<typeof ReleaseAssetSchema>

/** Also the shape of the test-only release override file (`TEST_ENV.releaseOverride`). */
export const EditorReleaseSchema = z.object({
  version: z.string(),
  baseUrl: z.string(),
  stripComponents: z.number().int().min(0),
  binPath: z.object({ posix: z.string(), win32: z.string() }),
  assets: z.record(z.string(), ReleaseAssetSchema),
})
export type EditorRelease = z.infer<typeof EditorReleaseSchema>

/** VSCodium 1.143.17232 (VS Code 1.143.1, 2026-10-28); sha256 = GitHub asset digest (spike cross-checked one). */
export const PINNED_RELEASE: EditorRelease = {
  version: PINNED_VERSION,
  baseUrl: RELEASE_BASE_URL,
  stripComponents: ARCHIVE_STRIP_COMPONENTS,
  binPath: { ...SERVER_BIN },
  assets: {
    'darwin-arm64': {
      file: `vscodium-reh-web-darwin-arm64-${PINNED_VERSION}.tar.gz`,
      sha256: '2a33e8d5c39cad9a1f6c81a56c908367a60738f08ff72304ff42b62652c41b01',
      sizeBytes: 96_507_870,
    },
    'darwin-x64': {
      file: `vscodium-reh-web-darwin-x64-${PINNED_VERSION}.tar.gz`,
      sha256: '414a4d2ec2abd60d9a2704d0dd205c256e13ece2f162a3889b914e4a92fb2184',
      sizeBytes: 98_187_162,
    },
    'linux-x64': {
      file: `vscodium-reh-web-linux-x64-${PINNED_VERSION}.tar.gz`,
      sha256: '0d1e00fa4e3564617aba798a88395d9a5fb507d771d711e0454bb1065a030f7c',
      sizeBytes: 102_751_725,
    },
    'linux-arm64': {
      file: `vscodium-reh-web-linux-arm64-${PINNED_VERSION}.tar.gz`,
      sha256: '5ad0ccbda2010e99dbb8306fbabfcfd91c80a56ad579ad7903f6635b95d0615f',
      sizeBytes: 100_314_479,
    },
    'win32-x64': {
      file: `vscodium-reh-web-win32-x64-${PINNED_VERSION}.tar.gz`,
      sha256: '391348e8fcecce9a6a14907d9663d5d0a67726abb2a001a71aaabe2616613489',
      sizeBytes: 95_599_178,
    },
  },
}

export type ResolvedAsset = ReleaseAsset & { url: string; key: string }

/** The asset for this platform/arch, with its download URL. */
export function resolveAsset(
  rel: EditorRelease,
  platform: NodeJS.Platform,
  arch: string,
): ResolvedAsset | { error: 'unsupportedPlatform' } {
  const key = `${platform}${ASSET_KEY_SEPARATOR}${arch}`
  const found = rel.assets[key]
  if (!found) return { error: UNSUPPORTED_PLATFORM }
  return { ...found, key, url: new URL(found.file, rel.baseUrl).href }
}

export const isResolved = (a: ResolvedAsset | { error: 'unsupportedPlatform' }): a is ResolvedAsset => 'url' in a
