import { makeLaunchContext } from '@pragma/module-agents/testing'
import { describe, expect, it, vi } from 'vitest'
import type { ResumeCapability } from '../src/contract'
import { createExternalSessionGuard } from '../src/main/external-session-guard'
import { createResumeDecorator } from '../src/main/resume-decorator'
import {
  CLAUDE,
  claudeResume,
  EXTERNAL_ID,
  fakeProviders,
  makeProfile,
  OTHER_SESSION_ID,
  SERVE_URL,
  SESSION_ID,
} from './support'

const BASE = { command: 'claude', args: ['--base'], env: { A: '1' }, cwd: '/w' }
const ctx = (resume?: { externalSessionId: string; serverUrl?: string }) =>
  makeLaunchContext({ profile: makeProfile(), sessionId: SESSION_ID, ...(resume ? { resume } : {}) })

function setup(cap: ResumeCapability | null = claudeResume()) {
  const guard = createExternalSessionGuard()
  const providers = fakeProviders({ resume: cap ? { [CLAUDE]: cap } : {} })
  return { guard, cap, decorator: createResumeDecorator({ providers, guard }) }
}

describe('resume launch decorator', () => {
  it('id and order run before 04 status (100)', () => {
    const { decorator } = setup()
    expect(decorator.id).toBe('chat-switch.resume')
    expect(decorator.order).toBeLessThan(100)
  })

  it('no resume → unchanged', async () => {
    const { decorator, guard } = setup()
    expect(await decorator.decorate(BASE, ctx())).toEqual(BASE)
    expect(guard.ownerOf({ providerId: CLAUDE, externalSessionId: EXTERNAL_ID })).toBeUndefined()
  })

  it('appends args, merges env and claims the guard for ctx.sessionId', async () => {
    const cap: ResumeCapability = {
      canResumeInChat: true,
      terminalResumeArgs: () => ({ args: ['--resume', 'X'], env: { K: 'v' } }),
    }
    const { decorator, guard } = setup(cap)
    const spec = await decorator.decorate(BASE, ctx({ externalSessionId: EXTERNAL_ID }))
    expect(spec).toEqual({ ...BASE, args: ['--base', '--resume', 'X'], env: { A: '1', K: 'v' } })
    expect(guard.ownerOf({ providerId: CLAUDE, externalSessionId: EXTERNAL_ID })).toBe(SESSION_ID)
  })

  it('forwards resume.serverUrl to the capability', async () => {
    const { decorator, cap } = setup()
    await decorator.decorate(BASE, ctx({ externalSessionId: EXTERNAL_ID, serverUrl: SERVE_URL }))
    expect(cap?.terminalResumeArgs).toHaveBeenCalledWith({ externalSessionId: EXTERNAL_ID, serverUrl: SERVE_URL })
  })

  it('busy id throws chat-switch:error.busy and does not call the capability', async () => {
    const { decorator, guard, cap } = setup()
    guard.claim({ providerId: CLAUDE, externalSessionId: EXTERNAL_ID }, OTHER_SESSION_ID)
    await expect(decorator.decorate(BASE, ctx({ externalSessionId: EXTERNAL_ID }))).rejects.toThrow(
      'chat-switch:error.busy',
    )
    expect(cap?.terminalResumeArgs).not.toHaveBeenCalled()
  })

  it('missing capability throws noResume', async () => {
    const { decorator } = setup(null)
    await expect(decorator.decorate(BASE, ctx({ externalSessionId: EXTERNAL_ID }))).rejects.toThrow(
      'chat-switch:reason.noResume',
    )
  })

  it('a throwing capability propagates (03 logs and skips the decorator)', async () => {
    const cap: ResumeCapability = {
      canResumeInChat: true,
      terminalResumeArgs: vi.fn(() => {
        throw new Error('bad id')
      }),
    }
    const { decorator } = setup(cap)
    await expect(decorator.decorate(BASE, ctx({ externalSessionId: EXTERNAL_ID }))).rejects.toThrow('bad id')
  })
})
