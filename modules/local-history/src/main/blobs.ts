import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { writeFileAtomic } from '@pragma/sdk/main'
import { BINARY_SNIFF_BYTES, HASH, HEX, MAX_SAVED_FILE_BYTES, NUL } from '../constants'
import { FILE_STATE, type FileState } from '../contract'

export interface Captured {
  state: FileState
  blob: string | null
  size: number
}

const isBinary = (bytes: Buffer): boolean => bytes.subarray(0, BINARY_SNIFF_BYTES).includes(NUL)

/** Content-addressed file store: identical content is kept once, whatever entry or path it came from. */
export function createBlobStore(dir: string) {
  mkdirSync(dir, { recursive: true })
  const pathOf = (blob: string): string => join(dir, blob)
  return {
    /** Saves the file at `file` as it is now (or notes why it was not saved). */
    capture(file: string): Captured {
      if (!existsSync(file) || !statSync(file).isFile()) return { state: FILE_STATE.missing, blob: null, size: 0 }
      const size = statSync(file).size
      if (size > MAX_SAVED_FILE_BYTES) return { state: FILE_STATE.tooLarge, blob: null, size }
      const bytes = readFileSync(file)
      if (isBinary(bytes)) return { state: FILE_STATE.binary, blob: null, size }
      const blob = createHash(HASH).update(bytes).digest(HEX)
      if (!existsSync(pathOf(blob))) writeFileAtomic(pathOf(blob), bytes)
      return { state: FILE_STATE.saved, blob, size }
    },
    read: (blob: string): Buffer | null => (existsSync(pathOf(blob)) ? readFileSync(pathOf(blob)) : null),
    /** Deletes every blob not in `keep`; returns how many went. */
    sweep(keep: ReadonlySet<string>): number {
      let removed = 0
      for (const name of readdirSync(dir)) {
        if (keep.has(name)) continue
        rmSync(pathOf(name), { force: true })
        removed++
      }
      return removed
    },
  }
}
export type BlobStore = ReturnType<typeof createBlobStore>
