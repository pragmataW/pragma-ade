import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BRIDGE_INFO_FILE, BRIDGE_PROTOCOL_VERSION } from '@pragma/module-bridge/contract'
import { afterEach } from 'vitest'

export const TEST_TOKEN = 'test-token-0123456789abcdef'

/** A temp dir removed after the current test. */
export function tempDir(prefix = 'pragma-cli-test-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  afterEach(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

/** Writes `<dir>/bridge.json` (or `file`) pointing at `url`; returns its path. */
export function writeBridgeFile(dir: string, url: string, file = BRIDGE_INFO_FILE): string {
  mkdirSync(dir, { recursive: true })
  const path = join(dir, file)
  const info = { version: BRIDGE_PROTOCOL_VERSION, url, wsUrl: `${url}/ws`, token: TEST_TOKEN, pid: 1, startedAt: '' }
  writeFileSync(path, JSON.stringify(info))
  return path
}
