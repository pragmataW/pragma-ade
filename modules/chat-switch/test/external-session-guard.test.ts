import { describe, expect, it } from 'vitest'
import { createExternalSessionGuard } from '../src/main/external-session-guard'
import { CLAUDE, EXTERNAL_ID, OPENCODE, OTHER_SESSION_ID, SESSION_ID } from './support'

const key = (externalSessionId = EXTERNAL_ID, providerId = CLAUDE) => ({ providerId, externalSessionId })

describe('ExternalSessionGuard', () => {
  it('first claim wins', () => {
    const g = createExternalSessionGuard()
    expect(g.claim(key(), SESSION_ID)).toEqual({ ok: true })
    expect(g.claim(key(), OTHER_SESSION_ID)).toEqual({ ok: false, ownerSessionId: SESSION_ID })
  })

  it('same session re-claim is idempotent', () => {
    const g = createExternalSessionGuard()
    g.claim(key(), SESSION_ID)
    expect(g.claim(key(), SESSION_ID)).toEqual({ ok: true })
    expect(g.ownerOf(key())).toBe(SESSION_ID)
  })

  it('re-claim with a new id for the same session frees the old key', () => {
    const g = createExternalSessionGuard()
    g.claim(key('old'), SESSION_ID)
    g.claim(key('new'), SESSION_ID)
    expect(g.ownerOf(key('old'))).toBeUndefined()
    expect(g.ownerOf(key('new'))).toBe(SESSION_ID)
    expect(g.claim(key('old'), OTHER_SESSION_ID)).toEqual({ ok: true })
  })

  it.each([
    ['release frees the key', (g: ReturnType<typeof createExternalSessionGuard>) => g.release(SESSION_ID), true],
    [
      'releasing another session keeps it',
      (g: ReturnType<typeof createExternalSessionGuard>) => g.release(OTHER_SESSION_ID),
      false,
    ],
  ])('%s', (_n, act, freed) => {
    const g = createExternalSessionGuard()
    g.claim(key(), SESSION_ID)
    act(g)
    expect(g.ownerOf(key()) === undefined).toBe(freed)
  })

  it('keys are provider-scoped', () => {
    const g = createExternalSessionGuard()
    g.claim(key(EXTERNAL_ID, CLAUDE), SESSION_ID)
    expect(g.claim(key(EXTERNAL_ID, OPENCODE), OTHER_SESSION_ID)).toEqual({ ok: true })
  })
})
