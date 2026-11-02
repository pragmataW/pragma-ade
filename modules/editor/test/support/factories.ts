import type { EditorRelease } from '../../src/main/release/release'
import { FAKE_BIN } from './makeFakeArchive'

export const FAKE_VERSION = '0.0.0-fake'
export const HOST_KEY = `${process.platform}-${process.arch}`
export const FAKE_FILE = `fake-reh-${HOST_KEY}.tar.gz`

/** A release whose only asset (this platform) is `FAKE_FILE` under `baseUrl`. */
export function fakeRelease(o: {
  baseUrl: string
  sha256: string
  sizeBytes: number
  version?: string
}): EditorRelease {
  return {
    version: o.version ?? FAKE_VERSION,
    baseUrl: o.baseUrl,
    stripComponents: 0,
    binPath: { posix: FAKE_BIN, win32: FAKE_BIN },
    assets: { [HOST_KEY]: { file: FAKE_FILE, sha256: o.sha256, sizeBytes: o.sizeBytes } },
  }
}
