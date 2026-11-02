import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, type WriteStream } from 'node:fs'
import { mkdir, rename, rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  ABORT_ERROR,
  CONTENT_LENGTH,
  DOWNLOAD_FAILURE as F,
  HASH_ALGORITHM,
  HEX,
  NODE_EVENT,
  PART_SUFFIX,
  PROGRESS_INTERVAL_MS,
} from '../../constants'

export interface DownloadOptions {
  url: string
  dest: string
  expectedSha256: string
  signal?: AbortSignal
  onProgress?(received: number, total: number): void
  fetchImpl?: typeof fetch
  progressIntervalMs?: number
}

export type DownloadResult =
  | { ok: true; sha256: string }
  | { ok: false; reason: 'checksumMismatch'; actual: string }
  | { ok: false; reason: 'aborted' }
  | { ok: false; reason: 'http'; status: number }
  | { ok: false; reason: 'network'; message: string }

class HttpStatusError extends Error {
  readonly status: number
  constructor(status: number) {
    super(`HTTP ${status}`)
    this.status = status
  }
}

const write = (out: WriteStream, chunk: Uint8Array): Promise<void> =>
  new Promise((resolve, reject) => {
    out.write(chunk, (error) => (error ? reject(error) : resolve()))
  })

const close = (out: WriteStream): Promise<void> =>
  new Promise((resolve, reject) => {
    out.end((error?: Error | null) => (error ? reject(error) : resolve()))
  })

/** Throttled progress: at most one call per interval, plus the final one. */
function progressReporter(o: DownloadOptions, total: number): (received: number, final?: boolean) => void {
  const interval = o.progressIntervalMs ?? PROGRESS_INTERVAL_MS
  let last = Number.NEGATIVE_INFINITY
  let reported = -1
  return (received, final = false) => {
    const now = Date.now()
    if (received === reported || (!final && now - last < interval)) return
    last = now
    reported = received
    o.onProgress?.(received, total || received)
  }
}

/** Streams the body into `part` while hashing it; returns the hex digest. */
async function streamToPart(o: DownloadOptions, part: string): Promise<string> {
  const res = await (o.fetchImpl ?? fetch)(o.url, { signal: o.signal, redirect: 'follow' })
  if (!res.ok || !res.body) throw new HttpStatusError(res.status)
  const total = Number(res.headers.get(CONTENT_LENGTH) ?? 0) || 0
  const report = progressReporter(o, total)
  const hash = createHash(HASH_ALGORITHM)
  const out = createWriteStream(part)
  let received = 0
  try {
    const reader = res.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      hash.update(value)
      await write(out, value)
      received += value.length
      report(received)
    }
  } finally {
    await close(out)
  }
  report(received, true)
  return hash.digest(HEX)
}

function failure(error: unknown, signal: AbortSignal | undefined): DownloadResult {
  if (error instanceof HttpStatusError) return { ok: false, reason: F.http, status: error.status }
  if (signal?.aborted || (error instanceof Error && error.name === ABORT_ERROR)) return { ok: false, reason: F.aborted }
  return { ok: false, reason: F.network, message: error instanceof Error ? error.message : String(error) }
}

/** Downloads to `${dest}.part`, verifies SHA-256, then renames to `dest`; on any failure no file is left behind. */
export async function downloadVerified(o: DownloadOptions): Promise<DownloadResult> {
  const part = `${o.dest}${PART_SUFFIX}`
  await mkdir(dirname(o.dest), { recursive: true })
  let actual: string
  try {
    actual = await streamToPart(o, part)
  } catch (error) {
    await rm(part, { force: true })
    return failure(error, o.signal)
  }
  if (actual !== o.expectedSha256.toLowerCase()) {
    await rm(part, { force: true })
    return { ok: false, reason: F.checksumMismatch, actual }
  }
  await rename(part, o.dest)
  return { ok: true, sha256: actual }
}

/** Hex SHA-256 of a file (streamed). */
export function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash(HASH_ALGORITHM)
    createReadStream(path)
      .on(NODE_EVENT.data, (chunk) => hash.update(chunk))
      .on(NODE_EVENT.error, reject)
      .on(NODE_EVENT.end, () => resolve(hash.digest(HEX)))
  })
}
