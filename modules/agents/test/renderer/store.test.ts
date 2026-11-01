import { aProfile, aSession } from '@pragma/module-agents/testing'
import type { IpcContract } from '@pragma/sdk'
import { expect, it } from 'vitest'
import { AGENTS_IPC } from '../../src/contract'
import { type AgentsIpcClient, createAgentsStore } from '../../src/renderer/store'

const session = aSession

function setup(replies: Record<string, unknown> = {}) {
  const calls: [string, unknown][] = []
  const ipc: AgentsIpcClient = {
    async invoke<I, O>(c: IpcContract<I, O>, input: I) {
      calls.push([c.channel, input])
      return replies[c.channel] as O
    },
  }
  return { store: createAgentsStore(ipc, () => undefined), calls }
}

it('init loads providers and profiles', async () => {
  const { store } = setup({ [AGENTS_IPC.listProviders]: [{ id: 'claude' }], [AGENTS_IPC.listProfiles]: [aProfile()] })
  await store.getState().init()
  expect(store.getState().providers).toEqual([{ id: 'claude' }])
  expect(store.getState().profiles.map((p) => p.id)).toEqual(['p1'])
})

it('loadSessions selects the most recently focused tab', async () => {
  const { store } = setup({ [AGENTS_IPC.listSessions]: [session('b', 2, { lastFocusedAt: 9 }), session('a', 1)] })
  await store.getState().loadSessions('w1')
  expect(store.getState().sessions.w1?.map((x) => x.id)).toEqual(['a', 'b'])
  expect(store.getState().activeSessionId.w1).toBe('b')
})

it('applySessionChanged with reveal selects', () => {
  const { store } = setup()
  store.getState().applySessionChanged({ session: session('a', 1), reveal: false })
  store.getState().applySessionChanged({ session: session('b', 2), reveal: false })
  expect(store.getState().activeSessionId.w1).toBe('a')
  store.getState().applySessionChanged({ session: session('c', 3), reveal: true })
  expect(store.getState().activeSessionId.w1).toBe('c')
})

it('closed session removed and neighbour selected', () => {
  const { store } = setup()
  for (const [id, n] of [
    ['a', 1],
    ['b', 2],
    ['c', 3],
  ] as const)
    store.getState().applySessionChanged({ session: session(id, n), reveal: id === 'b' })
  store.getState().applySessionChanged({ session: session('b', 2, { closedAt: 5 }), reveal: false })
  expect(store.getState().sessions.w1?.map((x) => x.id)).toEqual(['a', 'c'])
  expect(store.getState().activeSessionId.w1).toBe('c')
})

it('selectSession focuses through IPC', () => {
  const { store, calls } = setup()
  store.getState().selectSession('w1', 'a')
  expect(store.getState().activeSessionId.w1).toBe('a')
  expect(calls).toEqual([[AGENTS_IPC.focusSession, { id: 'a' }]])
})

it('profilesChanged replaces profiles and drops cached checks', async () => {
  const { store } = setup({ [AGENTS_IPC.checkProfile]: { resolution: { status: 'notFound' }, compatibility: null } })
  await store.getState().refreshCheck('p1')
  expect(store.getState().checks.p1).toBeDefined()
  store.getState().applyProfilesChanged({ profiles: [aProfile({ id: 'x' })] })
  expect(store.getState().checks).toEqual({})
  expect(store.getState().profiles.map((p) => p.id)).toEqual(['x'])
})
