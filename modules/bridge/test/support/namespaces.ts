import { z } from '@pragma/sdk'
import { type BridgeRequestContext, defineBridgeNamespace } from '../../src/contract'

/** A small namespace used across bridge tests. */
export const demoNs = defineBridgeNamespace({
  name: 'demo',
  requests: {
    echo: { input: z.object({ text: z.string() }), output: z.object({ text: z.string() }) },
    fail: { input: z.null(), output: z.null() },
    bad: { input: z.null(), output: z.object({ ok: z.boolean() }) },
  },
  events: { tick: z.object({ n: z.number() }) },
})

export const httpCtx: BridgeRequestContext = { clientId: 'http:test', transport: 'http' }

export const demoHandlers = {
  echo: ({ text }: { text: string }) => ({ text }),
  fail: (): null => {
    throw new Error('boom')
  },
  bad: () => ({ ok: 'nope' }) as unknown as { ok: boolean },
}
