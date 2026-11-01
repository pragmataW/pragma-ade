import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { bundleHook } from '../scripts/bundle-hook.mjs'
import { claimStatusReporter, createSendQueue, readHookEnv, sendHookEvent, truncateField } from '../src/client'
import { AgentHookEventInputSchema } from '../src/contract'
import { setupAgentBridge } from './support/bridge'

const startBridge = setupAgentBridge()
const FULL = { PRAGMA_BRIDGE_URL: 'http://127.0.0.1:1', PRAGMA_BRIDGE_TOKEN: 't', PRAGMA_SESSION_ID: 's' }

describe('hook-side client', () => {
  it.each<[string, Record<string, string>, boolean]>([
    ['all set', FULL, true],
    ['url missing', { ...FULL, PRAGMA_BRIDGE_URL: '' }, false],
    ['token missing', { PRAGMA_BRIDGE_URL: 'u', PRAGMA_SESSION_ID: 's' }, false],
    ['session missing', { PRAGMA_BRIDGE_URL: 'u', PRAGMA_BRIDGE_TOKEN: 't' }, false],
  ])('readHookEnv: %s', (_n, env, ok) => {
    expect(readHookEnv(env) !== null).toBe(ok)
  })

  it('sendHookEvent posts an envelope that validates against AgentHookEventInputSchema', async () => {
    const { received, hookEnv } = await startBridge()
    await sendHookEvent(hookEnv, 'claude', { hook_event_name: 'Stop' })
    expect(received).toHaveLength(1)
    expect(AgentHookEventInputSchema.parse(received[0])).toEqual({
      sessionId: 's1',
      providerId: 'claude',
      event: { hook_event_name: 'Stop' },
    })
  })

  it('never throws when the bridge is down', async () => {
    const started = Date.now()
    const env = { bridgeUrl: 'http://127.0.0.1:9', bridgeToken: 't', sessionId: 's' }
    await expect(sendHookEvent(env, 'x', {})).resolves.toBeUndefined()
    expect(Date.now() - started).toBeLessThan(2500)
  })

  it('queue preserves order when the first post is slow', async () => {
    const { received, hookEnv } = await startBridge({ delayFirstMs: 150 })
    const send = createSendQueue(hookEnv, 'opencode')
    void send({ n: 1 })
    await send({ n: 2 })
    expect(received.map((r) => (r.event as { n: number }).n)).toEqual([1, 2])
  })

  it('claimStatusReporter claims once', () => {
    const env: Record<string, string | undefined> = {}
    expect(claimStatusReporter(env)).toBe(true)
    expect(env.PRAGMA_STATUS_CLAIMED).toBe('1')
    expect(claimStatusReporter(env)).toBe(false)
  })

  it.each<[unknown, string | undefined]>([
    ['abc', 'abc'],
    ['x'.repeat(250), 'x'.repeat(200)],
    [42, undefined],
    [undefined, undefined],
  ])('truncateField(%j)', (input, out) => {
    expect(truncateField(input)).toBe(out)
  })

  it('the bundled client contains no zod', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pragma-hook-bundle-'))
    try {
      const result = await bundleHook({
        entry: join(import.meta.dirname, '../src/client/index.ts'),
        outfile: join(dir, 'client.mjs'),
        write: false,
      })
      const text = result.outputFiles?.[0]?.text ?? ''
      expect(text).toContain('hookEvent')
      expect(text).toContain('PRAGMA_SESSION_ID')
      expect(text).not.toMatch(/zod|ZodError|ZodObject/)
      expect(text).not.toContain('createServiceToken')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
