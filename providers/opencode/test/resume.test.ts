import { INVALID_EXTERNAL_ID_MESSAGE } from '@pragma/module-chat-switch/contract'
import { describe, expect, it } from 'vitest'
import { passwordForServerUrl, rememberServerPassword } from '../src/main/chat/server/passwords'
import { createOpencodeResumeCapability, UNKNOWN_SERVER_MESSAGE } from '../src/main/resume.capability'

const URL = 'http://127.0.0.1:43123'
const cap = createOpencodeResumeCapability({ passwordFor: (url) => (url === URL ? 'pw' : undefined) })

describe('opencode resume capability (2.x)', () => {
  it.each([
    [{ externalSessionId: 'ses_8a1' }, { args: ['--session', 'ses_8a1'], env: {} }],
    [
      { externalSessionId: 'ses_8a1', serverUrl: URL },
      { args: ['--server', URL, '--session', 'ses_8a1'], env: { OPENCODE_PASSWORD: 'pw' } },
    ],
  ])('terminalResumeArgs(%j)', (input, spec) => expect(cap.terminalResumeArgs(input)).toEqual(spec))

  it('an unknown server throws', () =>
    expect(() => cap.terminalResumeArgs({ externalSessionId: 'ses_8a1', serverUrl: 'http://127.0.0.1:1' })).toThrow(
      UNKNOWN_SERVER_MESSAGE,
    ))

  it.each(['', '-p', '--resume', 'a b', 'abc'])('rejects id %j', (id) =>
    expect(() => cap.terminalResumeArgs({ externalSessionId: id })).toThrow(INVALID_EXTERNAL_ID_MESSAGE),
  )

  it('can resume in chat', () => expect(cap.canResumeInChat).toBe(true))

  it('password registry: remember, look up, forget', () => {
    const forget = rememberServerPassword(URL, 'secret')
    expect(passwordForServerUrl(URL)).toBe('secret')
    forget()
    expect(passwordForServerUrl(URL)).toBeUndefined()
  })
})
