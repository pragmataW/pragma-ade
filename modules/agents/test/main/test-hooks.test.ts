import { expect, it } from 'vitest'
import mainModule from '../../src/main/index'
import { getMainRuntime } from '../../src/main/runtime'
import { createAgentsTestHooks } from '../../src/main/test-hooks'
import { perTestDb } from '../support/db'
import { fakeMainContext } from '../support/main-context'

const db = perTestDb()

async function hooks() {
  const f = fakeMainContext(db())
  await mainModule.activate(f.ctx)
  return { ...f, hooks: createAgentsTestHooks(getMainRuntime(), f.ctx.events) }
}

it('getSessionOutput accumulates pty data', async () => {
  const h = await hooks()
  const s = await h.hooks.startSession({ worktreeId: 'w1' })
  h.pty.data(s.ptyId as string, 'fake-agent ready\r\n')
  h.pty.data(s.ptyId as string, '> ')
  expect(h.hooks.getSessionOutput(s.id)).toBe('fake-agent ready\r\n> ')
  expect(h.hooks.getSessionOutput('other')).toBe('')
})

it('waitForSessionStatus resolves on exited', async () => {
  const h = await hooks()
  const s = await h.hooks.startSession({ worktreeId: 'w1' })
  const waiting = h.hooks.waitForSessionStatus(s.id, 'exited')
  h.pty.exit(s.ptyId as string, 0)
  expect(await waiting).toMatchObject({ id: s.id, status: 'exited', exitCode: 0 })
})

it('waitForSessionStatus rejects after timeout', async () => {
  const h = await hooks()
  const s = await h.hooks.startSession({ worktreeId: 'w1' })
  await expect(h.hooks.waitForSessionStatus(s.id, 'exited', 120)).rejects.toThrow(/not exited after 120ms/)
})

it('profile hooks publish agents.profilesChanged so the renderer refreshes', async () => {
  const h = await hooks()
  const changes = () => h.published.filter((p) => p.channel === 'agents.profilesChanged')
  const before = changes().length
  await h.hooks.updateProfile('builtin:claude', { command: 'dgc' })
  expect(changes()).toHaveLength(before + 1)
  expect(changes().at(-1)?.payload).toMatchObject({
    profiles: expect.arrayContaining([expect.objectContaining({ command: 'dgc' })]),
  })
})
