import { worktreeRemoved } from '@pragma/module-projects/contract'
import { expect, it, vi } from 'vitest'
import type { AgentSessionsService } from '../../src/contract'
import { AGENTS_IPC, AgentSessionsServiceToken, agentsIpc, type SessionChangedPayload } from '../../src/contract'
import mainModule from '../../src/main/index'
import { perTestDb } from '../support/db'
import { fakeMainContext } from '../support/main-context'

const db = perTestDb()

async function activated() {
  const f = fakeMainContext(db())
  await mainModule.activate(f.ctx)
  const service = f.services.get(AgentSessionsServiceToken.id) as AgentSessionsService
  return { ...f, service }
}

it('provides the service and registers terminal mode', async () => {
  expect((await activated()).service.listModes()).toEqual(['terminal'])
})

it('registers exactly the AGENTS_IPC channels', async () => {
  expect([...(await activated()).handlers.keys()].sort()).toEqual(Object.values(AGENTS_IPC).sort())
})

it('seeds built-ins on activate', async () => {
  const f = await activated()
  expect((await f.invoke(agentsIpc.listProfiles, undefined)).map((p) => p.id)).toEqual([
    'builtin:claude',
    'builtin:opencode',
  ])
})

it('newSession command starts a session and publishes reveal:true', async () => {
  const f = await activated()
  const s = await f.ctx.commands.execute<{ id: string; worktreeId: string }>('agents.newSession', { worktreeId: 'w1' })
  expect(s.worktreeId).toBe('w1')
  const changes = f.published
    .filter((p) => p.channel === 'agents.sessionChanged')
    .map((p) => p.payload as SessionChangedPayload)
  expect(changes[0]).toMatchObject({ session: { id: s.id }, reveal: true })
})

it("worktree.removed closes that worktree's sessions", async () => {
  const f = await activated()
  const a = await f.service.startSession({ worktreeId: 'w1' })
  const b = await f.service.startSession({ worktreeId: 'w2' })
  f.ctx.events.emit(worktreeRemoved, { worktreeId: 'w1', projectId: 'proj1', path: '/repo', reason: 'user' })
  await vi.waitFor(async () => expect(await f.service.listSessions('w1')).toEqual([]))
  expect((await f.service.listSessions('w2')).map((s) => s.id)).toEqual([b.id])
  expect((await f.service.getSession(a.id))?.closedAt).not.toBeNull()
})

it('updateProfile with bad args rejects with agents:errors.argsInvalid', async () => {
  const f = await activated()
  await expect(f.invoke(agentsIpc.updateProfile, { id: 'builtin:claude', patch: { args: '"x' } })).rejects.toThrow(
    /^agents:errors\.argsInvalid/,
  )
})

it('profile mutations publish profilesChanged', async () => {
  const f = await activated()
  await f.invoke(agentsIpc.setDefaultProfile, { id: 'builtin:opencode' })
  expect(f.published.filter((p) => p.channel === 'agents.profilesChanged')).toHaveLength(1)
})

it('newWorktreeDefaults uses the repo default branch', async () => {
  expect(await (await activated()).invoke(agentsIpc.newWorktreeDefaults, { worktreeId: 'w1' })).toEqual({
    baseBranch: 'main',
  })
})

it('registers the CmdOrCtrl+T launcher shortcut from main (survives renderer reloads)', async () => {
  const f = await activated()
  expect(f.shortcuts).toEqual([
    expect.objectContaining({
      id: 'agents.openLauncher',
      accelerator: 'CmdOrCtrl+T',
      scope: 'app',
      command: 'agents.openLauncher',
    }),
  ])
})
