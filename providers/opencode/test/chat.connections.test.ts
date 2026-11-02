import { afterEach, describe, expect, it } from 'vitest'
import { createOpencodeChat } from '../src/main/chat/factory'
import { connectionListSchema, oauthAttemptSchema, oauthStatusSchema } from '../src/renderer/chat/connections'
import {
  BIN,
  cleanupAll,
  fakeCapCtx,
  fakeContextEnv,
  requestsOf,
  tempOpencodeHome,
} from '../testing/fake-opencode-server/harness'

const caps: { dispose(): Promise<void> }[] = []
afterEach(async () => {
  await Promise.all(caps.splice(0).map((c) => c.dispose()))
  await cleanupAll()
})

function setup() {
  const h = tempOpencodeHome()
  const env = fakeContextEnv(h, { scenario: 'provider-connect' })
  const cap = createOpencodeChat(fakeCapCtx({ getShellEnv: async () => env }), {
    idleGraceMs: 0,
    settingsCommand: { command: process.execPath, args: [BIN] },
  })
  caps.push(cap)
  const call = async (request: unknown) => cap.settingsCall?.(request)
  const list = async () => connectionListSchema.parse(await call({ op: 'list' })).providers
  return { h, call, list }
}

describe('Settings › OpenCode connections (settingsCall)', () => {
  it('lists integrations with credentials, env connections, methods, free and key-only notes', async () => {
    const providers = await setup().list()
    const byId = Object.fromEntries(providers.map((p) => [p.id, p]))
    expect(providers.map((p) => p.name)).toEqual([
      'Anthropic',
      'Broken',
      'Fake Provider',
      'Free Provider',
      'GitHub Copilot',
      'Hidden',
    ])
    expect(byId.fakeprov?.credentials).toEqual([{ id: 'cred_fake', label: 'API key', method: 'key' }])
    expect(byId.copilot).toMatchObject({ env: ['GITHUB_TOKEN'], key: false, oauth: [{ id: 'device' }] })
    expect(byId.freeprov?.free).toBe(true)
    expect(byId.anthropic).toMatchObject({ notice: 'keyOnly', key: true, oauth: [] })
  })

  it('connects by API key; a rejected key surfaces the server error; credentials can be removed', async () => {
    const s = setup()
    await expect(s.call({ op: 'keyConnect', integrationID: 'anthropic', key: 'sk-test' })).resolves.toEqual({
      ok: true,
    })
    const anthropic = (await s.list()).find((p) => p.id === 'anthropic')
    expect(anthropic?.credentials).toHaveLength(1)
    await expect(s.call({ op: 'keyConnect', integrationID: 'hiddenprov', key: 'bad-key' })).rejects.toThrow()
    await s.call({ op: 'remove', credentialID: anthropic?.credentials[0]?.id })
    expect((await s.list()).find((p) => p.id === 'anthropic')?.credentials).toEqual([])
    expect(requestsOf(s.h.log, /\/connect\/key$/).map((r) => r.body)).toEqual([{ key: 'sk-test' }, { key: 'bad-key' }])
  })

  it('OAuth: start → pending → complete; the attempt keeps its server; unknown attempts read expired', async () => {
    const s = setup()
    const attempt = oauthAttemptSchema.parse(
      await s.call({ op: 'oauthStart', integrationID: 'brokenprov', methodID: 'device' }),
    )
    expect(attempt).toMatchObject({ url: 'https://example.test/device', mode: 'auto' })
    const status = (a: string) => s.call({ op: 'oauthStatus', integrationID: 'brokenprov', attemptID: a })
    expect(oauthStatusSchema.parse(await status(attempt.attemptID)).status).toBe('pending')
    expect(oauthStatusSchema.parse(await status(attempt.attemptID)).status).toBe('complete')
    expect(oauthStatusSchema.parse(await status(attempt.attemptID)).status).toBe('expired')
    expect((await s.list()).find((p) => p.id === 'brokenprov')?.credentials).toHaveLength(2)
  })

  it('rejects invalid requests', async () => {
    await expect(setup().call({ op: 'nope' })).rejects.toThrow()
  })
})
