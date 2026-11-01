import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BRIDGE_INFO_FILE, type BridgeInfoFile, BridgeInfoFileSchema } from '../src/contract'
import { readInfoFile, removeInfoFile, writeInfoFile } from '../src/main/info-file'
import { useTempDirs } from './support/tmp'

const tempDir = useTempDirs()
const POSIX = process.platform !== 'win32'
const info = (token = 't'.repeat(43)): BridgeInfoFile => ({
  version: 1,
  url: 'http://127.0.0.1:1234',
  wsUrl: 'ws://127.0.0.1:1234/ws',
  token,
  pid: process.pid,
  startedAt: new Date(0).toISOString(),
})
const modeOf = (path: string): number => statSync(path).mode & 0o777

describe('bridge info file', () => {
  it('writeInfoFile → mode 0600 and parses with BridgeInfoFileSchema', () => {
    const path = writeInfoFile(tempDir(), info())
    if (POSIX) expect(modeOf(path)).toBe(0o600)
    expect(BridgeInfoFileSchema.parse(JSON.parse(readFileSync(path, 'utf8')))).toEqual(info())
  })

  it('overwrites an existing 0644 file and ends 0600', () => {
    const dir = tempDir()
    writeFileSync(join(dir, BRIDGE_INFO_FILE), '{}', { mode: 0o644 })
    const path = writeInfoFile(dir, info())
    if (POSIX) expect(modeOf(path)).toBe(0o600)
    expect(readInfoFile(dir)?.token).toBe(info().token)
  })

  it('removeInfoFile keeps another instance file', async () => {
    const dir = tempDir()
    writeInfoFile(dir, info('o'.repeat(43)))
    await removeInfoFile(dir, 'm'.repeat(43))
    expect(readInfoFile(dir)?.token).toBe('o'.repeat(43))
    await removeInfoFile(dir, 'o'.repeat(43))
    expect(readInfoFile(dir)).toBeNull()
  })

  it('removeInfoFile on a missing file resolves', async () => {
    await expect(removeInfoFile(tempDir(), 'x')).resolves.toBeUndefined()
  })
})
