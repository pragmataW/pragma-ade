import type { ChatOptionDescriptor } from '@pragma/module-chat/contract'
import { afterEach, describe, expect, it } from 'vitest'
import { errorCodeOf } from '../src/main/chat/mapping/event-mapper'
import { isLoopbackUrl, providerAccess } from '../src/main/chat/mapping/model-access'
import { buildOptionDescriptors } from '../src/main/chat/mapping/options'
import { integrationInfoSchema, listOf, modelInfoSchema, providerInfoSchema } from '../src/main/chat/schemas'
import {
  broadcast,
  chatSetup,
  cleanupAll,
  lastBody,
  readScenario,
  until,
  waitForEvent,
} from '../testing/fake-opencode-server/harness'

afterEach(cleanupAll)

const raw = readScenario('auth-error') as unknown as Record<string, unknown[]>
const providers = listOf(providerInfoSchema).parse({ data: raw.providers }).data
const integrations = listOf(integrationInfoSchema).parse({ data: raw.integrations }).data
const models = listOf(modelInfoSchema).parse({ data: raw.models }).data
const modelOption = (options: ChatOptionDescriptor[]) => options.find((d) => d.key === 'model')

describe('provider access', () => {
  it('offers connected, keyed (public) and config-only providers; hides unconnected and disabled ones', () => {
    const access = providerAccess(
      [...providers, { id: 'off', name: 'Off', activation: 'disabled' }],
      integrations,
      new Set(),
    )
    expect([...(access?.keys() ?? [])].sort()).toEqual(['brokenprov', 'fakeprov', 'freeprov', 'localprov'])
    expect(access?.get('localprov')).toEqual({ name: 'Local', local: true, reauth: false })
    expect(providerAccess(providers, integrations, new Set(['brokenprov']))?.get('brokenprov')?.reauth).toBe(true)
  })

  it.each([
    ['http://127.0.0.1:11434/v1', true],
    ['http://localhost:1234', true],
    ['http://[::1]:8080', true],
    ['https://api.openai.com/v1', false],
    ['not a url', false],
    [undefined, false],
  ])('isLoopbackUrl(%s) = %s', (url, expected) => expect(isLoopbackUrl(url)).toBe(expected))

  it('model choices: grouped by provider name, hints for local and re-auth providers; hidden default falls back', () => {
    const access = providerAccess(providers, integrations, new Set(['brokenprov']))
    const defaultModel = models.find((m) => m.id === 'nope') ?? null
    const model = modelOption(buildOptionDescriptors({ models, defaultModel, agents: [], access }, {}))
    expect(model?.values?.map((v) => [v.label, v.description, v.descriptionKey, v.warn])).toEqual([
      ['GPT', 'Broken', 'opencode:chat.model.reauth', true],
      ['Fake Model', 'Fake Provider', undefined, undefined],
      ['Free Model', 'Free Provider', undefined, undefined],
      ['Llama', 'Local', 'opencode:chat.model.local', undefined],
    ])
    expect(model?.default).toBe('brokenprov/gpt')
    const unfiltered = modelOption(buildOptionDescriptors({ models, defaultModel, agents: [], access: null }, {}))
    expect(unfiltered?.values).toHaveLength(models.length)
  })

  it.each([
    [{ type: 'provider.auth', message: 'x' }, 'auth'],
    [{ type: 'api_key_expired', message: 'x' }, 'auth'],
    [{ type: 'ProviderError', message: 'x', status: 401 }, 'auth'],
    [{ type: 'ProviderError', message: 'x', status: 429 }, 'rate_limit'],
    [{ type: 'ProviderError', message: 'x' }, 'turn_failed'],
  ])('errorCodeOf(%j) = %s', (e, code) => expect(errorCodeOf(e)).toBe(code))
})

describe('opencode chat session model list', () => {
  it('new session skips a hidden server default; an auth error flags the provider for re-auth', async () => {
    const s = chatSetup({ scenario: 'auth-error', testRoutes: true })
    const h = await s.start()
    expect(lastBody(s.h.log, /\/api\/session$/)).toMatchObject({ model: { providerID: 'brokenprov', id: 'gpt' } })
    expect(modelOption(h.describeOptions())?.values?.map((v) => v.value)).not.toContain('hiddenprov/nope')
    await h.send({ text: 'hi', images: [] })
    await waitForEvent(s.events, 'error', (e) => e.code === 'auth')
    await until(() => modelOption(h.describeOptions())?.values?.[0]?.descriptionKey === 'opencode:chat.model.reauth')
    await broadcast(s.h.log, 'credential.updated')
    await until(() => modelOption(h.describeOptions())?.values?.[0]?.descriptionKey === undefined)
  })
})
