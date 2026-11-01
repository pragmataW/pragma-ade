import { afterEach } from 'vitest'
import type { HookEnv } from '../../src/client'
import { type RecordingAgentBridge, startRecordingAgentBridge } from '../../testing/bridge'

/** A recording agent bridge per call, closed after each test; `hookEnv` targets session `s1`. */
export function setupAgentBridge(): (opts?: {
  delayFirstMs?: number
}) => Promise<RecordingAgentBridge & { hookEnv: HookEnv }> {
  const open: RecordingAgentBridge[] = []
  afterEach(async () => {
    for (const b of open.splice(0)) await b.server.close()
  })
  return async (opts) => {
    const b = await startRecordingAgentBridge(opts)
    open.push(b)
    return { ...b, hookEnv: { bridgeUrl: b.server.url, bridgeToken: b.server.token, sessionId: 's1' } }
  }
}
