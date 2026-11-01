import { isAbsolute, relative, resolve } from 'node:path'
import { BINARY_SNIFF_BYTES } from '../constants'
import { FILE_VERSION_KIND, type FileVersion } from '../contract'
import type { FsPort } from './diff-service'

const UTF8 = 'utf8'
const ENOENT = 'ENOENT'
const READ_ONLY = 'r'
const PARENT = '..'
const NUL = '\0'

/** A relative path that resolves outside the worktree. */
export class InvalidPathError extends Error {
  override name = 'InvalidPathError'
}

/** Git's heuristic: a NUL within the first `BINARY_SNIFF_BYTES` (characters, for `git show` text). */
export const looksBinary = (data: Buffer | string): boolean =>
  typeof data === 'string'
    ? data.slice(0, BINARY_SNIFF_BYTES).includes(NUL)
    : data.subarray(0, BINARY_SNIFF_BYTES).includes(0)

/** The absolute path of `rel` inside `cwd`; throws `InvalidPathError` when it escapes. */
export function resolveInside(cwd: string, rel: string): string {
  const abs = resolve(cwd, rel)
  const back = relative(resolve(cwd), abs)
  if (back === '' || back === PARENT || back.startsWith(`${PARENT}/`) || isAbsolute(back))
    throw new InvalidPathError(rel)
  return abs
}

const isEnoent = (e: unknown): boolean => (e as { code?: unknown }).code === ENOENT

/** True when the first `BINARY_SNIFF_BYTES` of the file contain a NUL. */
export async function sniffFile(fs: FsPort, abs: string): Promise<boolean> {
  const handle = await fs.open(abs, READ_ONLY)
  try {
    const buf = Buffer.alloc(BINARY_SNIFF_BYTES)
    const { bytesRead } = await handle.read(buf, 0, BINARY_SNIFF_BYTES, 0)
    return looksBinary(buf.subarray(0, bytesRead))
  } finally {
    await handle.close()
  }
}

/** The working-tree side: absent / unreadable (not a regular file) / tooLarge / binary / text (bytes kept as-is). */
export async function readDiskSide(fs: FsPort, cwd: string, rel: string, max: number): Promise<FileVersion> {
  const abs = resolveInside(cwd, rel)
  try {
    const stat = await fs.lstat(abs)
    if (!stat.isFile()) return { kind: FILE_VERSION_KIND.unreadable }
    if (stat.size > max) return { kind: FILE_VERSION_KIND.tooLarge, bytes: stat.size }
    const data = await fs.readFile(abs)
    if (looksBinary(data)) return { kind: FILE_VERSION_KIND.binary }
    return { kind: FILE_VERSION_KIND.text, contents: data.toString(UTF8) }
  } catch (error) {
    if (isEnoent(error)) return { kind: FILE_VERSION_KIND.absent }
    throw error
  }
}
