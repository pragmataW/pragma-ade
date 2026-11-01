import { randomBytes } from 'node:crypto'
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ZodType } from 'zod'
import { TEMP_SUFFIX_BYTES, UTF8 } from '../constants'

const DEFAULT_FILE_MODE = 0o666
const WRITE_FLAGS = 'wx'

/** Writes a sibling temp file, fsyncs it and renames it over `path`. The old file survives any failure. */
export function writeFileAtomic(path: string, data: string | Uint8Array, opts: { mode?: number } = {}): void {
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.${process.pid}.${randomBytes(TEMP_SUFFIX_BYTES).toString('hex')}.tmp`
  try {
    const fd = openSync(temp, WRITE_FLAGS, opts.mode ?? DEFAULT_FILE_MODE)
    try {
      writeSync(fd, typeof data === 'string' ? Buffer.from(data, UTF8) : data)
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
    renameSync(temp, path)
  } catch (error) {
    rmSync(temp, { force: true })
    throw error
  }
}

export const READ_JSON_FAILURE = { missing: 'missing', invalidJson: 'invalid-json', schema: 'schema' } as const
export type ReadJsonFailure = (typeof READ_JSON_FAILURE)[keyof typeof READ_JSON_FAILURE]

export type ReadJsonResult<T> = { ok: true; value: T } | { ok: false; reason: ReadJsonFailure; error?: unknown }

const isMissing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT'

/** Never throws for a missing file, invalid JSON or a schema mismatch. */
export function readJsonFile<T>(path: string, schema: ZodType<T>): ReadJsonResult<T> {
  let text: string
  try {
    text = readFileSync(path, UTF8)
  } catch (error) {
    if (isMissing(error)) return { ok: false, reason: READ_JSON_FAILURE.missing }
    throw error
  }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (error) {
    return { ok: false, reason: READ_JSON_FAILURE.invalidJson, error }
  }
  const parsed = schema.safeParse(raw)
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, reason: READ_JSON_FAILURE.schema, error: parsed.error }
}
