/** `@pragma/module-bridge/testing` (test code only). */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BridgeConnection } from '../src/client/http'
import { BRIDGE_PROTOCOL_VERSION } from '../src/contract'
import { writeInfoFile } from '../src/main/info-file'
import { createBridgeServer, type RunningBridgeServer } from '../src/main/server'

export type TestBridgeServer = RunningBridgeServer & { connection: BridgeConnection; infoDir: string }

/** A real bridge server on a free port, with a `bridge.json` in a temp `infoDir` (removed on `close`). */
export async function startTestBridgeServer(opts: { token?: string; port?: number } = {}): Promise<TestBridgeServer> {
  const server = await createBridgeServer(opts)
  const infoDir = mkdtempSync(join(tmpdir(), 'pragma-bridge-info-'))
  writeInfoFile(infoDir, {
    version: BRIDGE_PROTOCOL_VERSION,
    url: server.url,
    wsUrl: server.wsUrl,
    token: server.token,
    pid: process.pid,
    startedAt: new Date().toISOString(),
  })
  const close = server.close
  return Object.assign(server, {
    connection: { url: server.url, token: server.token },
    infoDir,
    async close() {
      await close()
      rmSync(infoDir, { recursive: true, force: true })
    },
  })
}
