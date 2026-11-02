import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { downloadVerified, sha256File } from '../src/main/install/download'
import { type HttpFixture, randomBody, sha256Of, startHttpFixture, tempDir } from './support/httpFixture'

const BODY = randomBody(512 * 1024)
const SHA = sha256Of(BODY)
let http: HttpFixture
const tmp = tempDir()
let n = 0
const dest = (): string => join(tmp.dir, `file-${++n}.bin`)

beforeAll(async () => {
  http = await startHttpFixture(BODY)
})
afterAll(async () => {
  await http.close()
  tmp.cleanup()
})

describe('downloadVerified', () => {
  it('downloads, reports progress monotonically and ends at total', async () => {
    const d = dest()
    const seen: [number, number][] = []
    const r = await downloadVerified({
      url: http.url('/slow'),
      dest: d,
      expectedSha256: SHA,
      progressIntervalMs: 0,
      onProgress: (a, b) => seen.push([a, b]),
    })
    expect(r).toEqual({ ok: true, sha256: SHA })
    expect(readFileSync(d).equals(BODY)).toBe(true)
    expect(seen.length).toBeGreaterThan(1)
    for (let i = 1; i < seen.length; i++) expect(seen[i]?.[0]).toBeGreaterThanOrEqual(seen[i - 1]?.[0] ?? 0)
    expect(seen.at(-1)).toEqual([BODY.length, BODY.length])
  })

  it('follows a redirect', async () => {
    const d = dest()
    expect(await downloadVerified({ url: http.url('/redirect'), dest: d, expectedSha256: SHA })).toMatchObject({
      ok: true,
    })
  })

  it('checksum mismatch returns actual hash and leaves neither dest nor .part', async () => {
    const d = dest()
    const r = await downloadVerified({ url: http.url('/file'), dest: d, expectedSha256: '0'.repeat(64) })
    expect(r).toEqual({ ok: false, reason: 'checksumMismatch', actual: SHA })
    expect(existsSync(d)).toBe(false)
    expect(existsSync(`${d}.part`)).toBe(false)
  })

  it('aborted download leaves no .part file', async () => {
    const d = dest()
    const ac = new AbortController()
    const r = await downloadVerified({
      url: http.url('/slow'),
      dest: d,
      expectedSha256: SHA,
      signal: ac.signal,
      progressIntervalMs: 0,
      onProgress: () => ac.abort(),
    })
    expect(r).toEqual({ ok: false, reason: 'aborted' })
    expect(existsSync(d)).toBe(false)
    expect(existsSync(`${d}.part`)).toBe(false)
  })

  it('http 404 → reason http', async () => {
    const d = dest()
    expect(await downloadVerified({ url: http.url('/missing'), dest: d, expectedSha256: SHA })).toEqual({
      ok: false,
      reason: 'http',
      status: 404,
    })
  })

  it('network error → reason network', async () => {
    const r = await downloadVerified({ url: 'http://127.0.0.1:1/x', dest: dest(), expectedSha256: SHA })
    expect(r).toMatchObject({ ok: false, reason: 'network' })
  })

  it('sha256File matches crypto of known bytes', async () => {
    const f = join(tmp.dir, 'known.bin')
    writeFileSync(f, BODY)
    expect(await sha256File(f)).toBe(SHA)
  })
})
