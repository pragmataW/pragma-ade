import { aProfile } from '@pragma/module-agents/testing'
import { describe, expect, it } from 'vitest'
import { resolveProfile } from '../src/main/resolve-profile'
import { fakeAgents } from './support/fakes'

const nameOf = (p: { name: string | null; id: string }) => p.name ?? p.id
const agents = fakeAgents({
  profiles: [
    aProfile({ id: 'builtin:claude', name: 'Claude', providerId: 'claude' }),
    aProfile({ id: 'custom-claude', name: 'claude', providerId: 'custom' }),
    aProfile({ id: 'builtin:opencode', name: 'OpenCode', providerId: 'opencode' }),
    aProfile({ id: 'old', name: 'Old Agent', enabled: false }),
  ],
})

describe('resolveProfile', () => {
  it.each([
    ['by id', 'custom-claude', 'custom-claude'],
    ['"opencode" matches name "OpenCode"', 'opencode', 'builtin:opencode'],
  ])('%s', async (_name, ref, id) => {
    expect((await resolveProfile(agents, ref, nameOf)).id).toBe(id)
  })

  it('two profiles named "Claude" → ambiguous with 2 candidates', async () => {
    const err = await resolveProfile(agents, 'CLAUDE', nameOf).catch((e: unknown) => e)
    expect(err).toMatchObject({ code: 'ambiguous' })
    expect((err as { details: { candidates: unknown[] } }).details.candidates).toHaveLength(2)
  })

  it('disabled → invalid_argument', async () => {
    await expect(resolveProfile(agents, 'old agent', nameOf)).rejects.toMatchObject({
      code: 'invalid_argument',
      message: "Profile 'Old Agent' is disabled.",
    })
  })

  it('unknown → not_found listing enabled names', async () => {
    const err = await resolveProfile(agents, 'gemini', nameOf).catch((e: unknown) => e)
    expect(err).toMatchObject({ code: 'not_found' })
    expect((err as Error).message).toContain('OpenCode')
    expect((err as Error).message).not.toContain('Old Agent')
  })
})
