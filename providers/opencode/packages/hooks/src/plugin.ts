// Portions adapted from onurravli/voltran (packages/daemon/src/opencode-plugin/index.ts): the subscribe loop with
// resubscribe and the sequential send queue. Licensed under the Apache License, Version 2.0
// (http://www.apache.org/licenses/LICENSE-2.0).
//
// OpenCode 2.x plugin: default export `{ id, setup(ctx) }`; loaded from a directory listed in
// OPENCODE_CONFIG_CONTENT.plugins by the Pragma status capability (never from the user's config).
import { claimStatusReporter, createSendQueue, readHookEnv } from '@pragma/module-agent-status/client'
import { OPENCODE_PLUGIN_ID, OPENCODE_PROVIDER_ID, READY_RECORD, RESUBSCRIBE_DELAY_MS } from './constants'
import { createRecordMapper } from './records'

interface BusEvent {
  type: string
  data?: unknown
}
interface PluginContext {
  event: { subscribe(opts: { signal: AbortSignal }): AsyncIterable<BusEvent> }
}

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve()
    })
  })

async function pump(ctx: PluginContext, signal: AbortSignal, forward: (ev: BusEvent) => void): Promise<void> {
  while (!signal.aborted) {
    try {
      for await (const ev of ctx.event.subscribe({ signal })) forward(ev)
    } catch {
      // the bus restarted or the iterator failed; resubscribe below
    }
    if (!signal.aborted) await sleep(RESUBSCRIBE_DELAY_MS, signal)
  }
}

function setup(ctx: PluginContext): (() => void) | undefined {
  const env = readHookEnv(process.env)
  if (!env || !claimStatusReporter(process.env)) return undefined
  const send = createSendQueue(env, OPENCODE_PROVIDER_ID)
  const map = createRecordMapper()
  const controller = new AbortController()
  void send({ type: READY_RECORD })
  void pump(ctx, controller.signal, (ev) => {
    const record = map(ev)
    if (record) void send({ ...record })
  })
  return () => controller.abort()
}

export default { id: OPENCODE_PLUGIN_ID, setup }
