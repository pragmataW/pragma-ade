import { startTestBridgeServer, type TestBridgeServer } from '@pragma/module-bridge/testing'
import { afterEach } from 'vitest'
import type { HookEnv } from '../../src/client'
import { type AgentHookEventInput, agentBridge } from '../../src/contract'

/** A test bridge with a recording `agent` namespace; closed after each test. */
export function setupAgentBridge(): (opts?: { delayFirstMs?: number }) => Promise<{
  server: TestBridgeServer
  received: AgentHookEventInput[]
  hookEnv: HookEnv
}> {
  const servers: TestBridgeServer[] = []
  afterEach(async () => {
    for (const s of servers.splice(0)) await s.close()
  })
  return async (opts = {}) => {
    const server = await startTestBridgeServer()
    servers.push(server)
    const received: AgentHookEventInput[] = []
    let first = true
    server.registerHandler(agentBridge, {
      hookEvent: async (input) => {
        if (first && opts.delayFirstMs) await new Promise((r) => setTimeout(r, opts.delayFirstMs))
        first = false
        received.push(input)
        return { accepted: true }
      },
    })
    return { server, received, hookEnv: { bridgeUrl: server.url, bridgeToken: server.token, sessionId: 's1' } }
  }
}
