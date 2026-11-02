import { agentSessionStatusChanged } from '@pragma/module-agent-status/contract'
import { agentSessionExited, agentSessionUpdated } from '@pragma/module-agents/contract'
import { describe, expect, it } from 'vitest'
import { chatSwitchIpc } from '../src/contract'
import { activateChatSwitch } from '../src/main/activate'
import {
  CLAUDE,
  chatOk,
  claudeResume,
  EXTERNAL_ID,
  fakeAgents,
  fakeChat,
  fakeComments,
  fakeEvents,
  fakeIpc,
  fakeProviders,
  makeSession,
  OTHER_SESSION_ID,
  SESSION_ID,
  silentLog,
} from './support'

const KEY = { providerId: CLAUDE, externalSessionId: EXTERNAL_ID }
const flush = () => new Promise((r) => setImmediate(r))

function setup() {
  const agents = fakeAgents([makeSession(), makeSession({ id: OTHER_SESSION_ID, mode: 'terminal' })])
  const chat = fakeChat()
  const events = fakeEvents()
  const ipc = fakeIpc()
  const main = activateChatSwitch({
    agents,
    chat,
    comments: fakeComments(),
    providers: fakeProviders({ resume: { [CLAUDE]: claudeResume() }, chat: { [CLAUDE]: chatOk() } }),
    events,
    ipc,
    worktreePath: async () => '/w',
    provide: () => undefined,
    log: silentLog(),
  })
  const published = (channel: string) => ipc.published.filter((p) => p.channel === channel).map((p) => p.payload)
  return { agents, chat, events, ipc, main, published }
}

describe('chat-switch main wiring', () => {
  it('registers the resume decorator and the IPC handlers', () => {
    const s = setup()
    expect(s.agents.decorators.map((d) => d.id)).toEqual(['chat-switch.resume'])
    expect([...s.ipc.handlers.keys()]).toEqual([chatSwitchIpc.eligibility.channel, chatSwitchIpc.switch.channel])
  })

  it('exited during a switch does not release', async () => {
    const s = setup()
    let release: () => void = () => undefined
    s.agents.relaunchSession.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve(makeSession({ mode: 'terminal' }))
        }),
    )
    const switching = s.main.service.switchTo(SESSION_ID, 'terminal')
    await flush()
    s.events.emit(agentSessionExited, { sessionId: SESSION_ID, worktreeId: 'w1', exitCode: 0 })
    expect(s.main.guard.ownerOf(KEY)).toBe(SESSION_ID)
    release()
    await switching
    s.events.emit(agentSessionExited, { sessionId: SESSION_ID, worktreeId: 'w1', exitCode: 0 })
    expect(s.main.guard.ownerOf(KEY)).toBeUndefined()
  })

  it('second live session reporting the same id publishes conflict', async () => {
    const s = setup()
    s.events.emit(agentSessionStatusChanged, {
      sessionId: SESSION_ID,
      status: 'working',
      externalSessionId: EXTERNAL_ID,
    })
    s.events.emit(agentSessionStatusChanged, {
      sessionId: OTHER_SESSION_ID,
      status: 'idle',
      externalSessionId: EXTERNAL_ID,
    })
    await flush()
    expect(s.published('chat-switch.conflict')).toEqual([{ sessionId: OTHER_SESSION_ID, ownerSessionId: SESSION_ID }])
    expect(s.main.guard.ownerOf(KEY)).toBe(SESSION_ID)
  })

  it('a new id for the same session follows the newest id', async () => {
    const s = setup()
    s.events.emit(agentSessionStatusChanged, { sessionId: SESSION_ID, status: 'idle', externalSessionId: EXTERNAL_ID })
    s.events.emit(agentSessionStatusChanged, { sessionId: SESSION_ID, status: 'idle', externalSessionId: 'next-id' })
    await flush()
    expect(s.main.guard.ownerOf(KEY)).toBeUndefined()
    expect(s.main.guard.ownerOf({ ...KEY, externalSessionId: 'next-id' })).toBe(SESSION_ID)
  })

  it('chat start guard refuses a busy id', () => {
    const s = setup()
    s.main.guard.claim(KEY, OTHER_SESSION_ID)
    const guard = s.chat.guards[0]
    expect(guard?.({ sessionId: SESSION_ID, ...KEY })).toEqual({ ok: false, reasonKey: 'chat-switch:reason.busy' })
    expect(guard?.({ sessionId: OTHER_SESSION_ID, ...KEY })).toEqual({ ok: true })
  })

  it('updated publishes changed idle and claims a running session id', () => {
    const s = setup()
    s.events.emit(agentSessionUpdated, { session: makeSession({ status: 'working' }), changed: ['status'] })
    expect(s.published('chat-switch.changed')).toEqual([{ sessionId: SESSION_ID, phase: 'idle' }])
    expect(s.main.guard.ownerOf(KEY)).toBe(SESSION_ID)
  })

  it('switch IPC routes to the service', async () => {
    const s = setup()
    expect(await s.ipc.invoke(chatSwitchIpc.switch, { sessionId: SESSION_ID, target: 'terminal' })).toEqual({
      ok: true,
      sessionId: SESSION_ID,
    })
  })
})
