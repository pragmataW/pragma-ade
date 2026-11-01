import { defineMainModule } from '@pragma/sdk/main'
import { BRIDGE_PROTOCOL_VERSION, BridgeServerToken } from '../contract'
import { removeInfoFile, writeInfoFile } from './info-file'
import { createBridgeServer, type RunningBridgeServer } from './server'

let running: { server: RunningBridgeServer; infoDir: string } | undefined

/** Starts the bridge, writes `<userData>/bridge.json` and provides `BridgeServerToken` before activation returns. */
export default defineMainModule({
  async activate(ctx) {
    let server: RunningBridgeServer
    try {
      server = await createBridgeServer({ log: ctx.log })
    } catch (e) {
      throw new Error(`bridge server could not listen on 127.0.0.1: ${String(e)}`)
    }
    const infoDir = ctx.paths.userData
    writeInfoFile(infoDir, {
      version: BRIDGE_PROTOCOL_VERSION,
      url: server.url,
      wsUrl: server.wsUrl,
      token: server.token,
      pid: process.pid,
      startedAt: new Date().toISOString(),
    })
    running = { server, infoDir }
    ctx.services.provide(BridgeServerToken, server)
    ctx.log.info(`bridge listening on ${server.url}`)
  },
  async deactivate() {
    const current = running
    running = undefined
    if (!current) return
    await current.server.close()
    await removeInfoFile(current.infoDir, current.server.token)
  },
})
