import { INVALID_EXTERNAL_ID_MESSAGE } from '@pragma/module-chat-switch/contract'
import { describe, expect, it } from 'vitest'
import { claudeResumeCapability as cap } from '../src/main/resume.capability'

const ID = '3f2c9a1e-8d4b-4c1a-9f00-1234567890ab'

describe('claude resume capability', () => {
  it.each([
    [{ externalSessionId: ID }, { args: ['--resume', ID], env: {} }],
    [
      { externalSessionId: ID, serverUrl: 'http://127.0.0.1:43123' },
      { args: ['--resume', ID], env: {} },
    ],
  ])('terminalResumeArgs(%j)', (input, spec) => expect(cap.terminalResumeArgs(input)).toEqual(spec))

  it('can resume in chat', () => expect(cap.canResumeInChat).toBe(true))

  it.each(['', '-p', '--resume', 'a b'])('rejects unsafe id %j', (id) =>
    expect(() => cap.terminalResumeArgs({ externalSessionId: id })).toThrow(INVALID_EXTERNAL_ID_MESSAGE),
  )
})
