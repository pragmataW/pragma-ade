import { describe, expect, it } from 'vitest'
import { type EligibilityInput, evaluateSwitch } from '../src/main/eligibility'
import { EXTERNAL_ID, OTHER_SESSION_ID, SESSION_ID } from './support'

const base = (patch: Partial<EligibilityInput> = {}, session: Partial<EligibilityInput['session']> = {}) => ({
  session: { id: SESSION_ID, mode: 'terminal', status: 'idle', externalSessionId: EXTERNAL_ID, ...session },
  hasResume: true,
  canResumeInChat: true,
  chatSupport: { ok: true } as EligibilityInput['chatSupport'],
  switching: false,
  ...patch,
})
const reason = (x: string) => ({ ok: false, reasonKey: `chat-switch:reason.${x}` })
const OK = { ok: true }

describe('evaluateSwitch', () => {
  it.each([
    ['current mode', base(), 'terminal', reason('currentMode')],
    ['switching', base({ switching: true }), 'chat', reason('switching')],
    // a terminal row without status hooks stays `starting`; switching still works (fresh when nothing to resume)
    ['starting → ok', base({}, { status: 'starting' }), 'chat', OK],
    ['starting without an id → ok', base({}, { status: 'starting', externalSessionId: null }), 'chat', OK],
    ['no resume', base({ hasResume: false }), 'chat', reason('noResume')],
    ['id unknown → ok (a fresh session)', base({}, { externalSessionId: null }), 'chat', OK],
    ['id unknown chat → terminal ok', base({}, { mode: 'chat', externalSessionId: null }), 'terminal', OK],
    ['busy', base({ busyOwnerSessionId: OTHER_SESSION_ID }), 'chat', reason('busy')],
    ['own claim is not busy', base({ busyOwnerSessionId: SESSION_ID }), 'chat', OK],
    ['chat resume unsupported', base({ canResumeInChat: false }), 'chat', reason('chatResumeUnsupported')],
    ['no chat capability', base({ chatSupport: 'no-capability' }), 'chat', reason('noChat')],
    [
      'chat unsupported',
      base({ chatSupport: { ok: false, reasonKey: 'chat:unsupported.x' } }),
      'chat',
      { ok: false, reasonKey: 'chat:unsupported.x' },
    ],
    ['exited terminal session with id → chat ok', base({}, { status: 'exited' }), 'chat', OK],
    ['switching without an id', base({ switching: true }, { externalSessionId: null }), 'chat', reason('switching')],
    ['chat → terminal ignores chat support', base({ chatSupport: 'no-capability' }, { mode: 'chat' }), 'terminal', OK],
  ] as const)('%s', (_name, input, target, expected) => expect(evaluateSwitch(input)[target]).toEqual(expected))
})
