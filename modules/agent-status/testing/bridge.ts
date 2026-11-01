import { startTestBridgeServer, type TestBridgeServer } from '@pragma/module-bridge/testing'
import { type AgentHookEventInput, agentBridge } from '../src/contract'

export interface RecordingAgentBridge {
  server: TestBridgeServer
  /** Every `agent.hookEvent` payload, in arrival order. */
  received: AgentHookEventInput[]
  /** The `type` field of each received event (OpenCode records). */
  types(): string[]
  /** `PRAGMA_BRIDGE_URL`/`TOKEN`/`SESSION_ID` for a hook process. */
  env(sessionId: string): Record<string, string>
}

/** A real test bridge whose `agent` namespace records every hook event (optionally delaying the first). */
export async function startRecordingAgentBridge(opts: { delayFirstMs?: number } = {}): Promise<RecordingAgentBridge> {
  const server = await startTestBridgeServer()
  const received: AgentHookEventInput[] = []
  server.registerHandler(agentBridge, {
    hookEvent: async (input) => {
      if (received.length === 0 && opts.delayFirstMs) await new Promise((r) => setTimeout(r, opts.delayFirstMs))
      received.push(input)
      return { accepted: true }
    },
  })
  return {
    server,
    received,
    types: () => received.map((r) => String((r.event as { type?: unknown }).type)),
    env: (sessionId) => ({
      PRAGMA_BRIDGE_URL: server.url,
      PRAGMA_BRIDGE_TOKEN: server.token,
      PRAGMA_SESSION_ID: sessionId,
    }),
  }
}
