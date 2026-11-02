import { aSession } from '@pragma/module-agents/testing'
import { describe, expect, it } from 'vitest'
import { createCliHandlers } from '../src/main/handlers'
import { aComment, aWorktree, context, fakeAgents, fakeComments, fakeProjects, makeDeps } from './support/fakes'

const ok = (result: unknown) => ({ ok: true, result })

describe('worktree handlers', () => {
  it("worktreeList without projectId uses PRAGMA_WORKTREE_ID's project", async () => {
    const projects = fakeProjects({
      worktrees: [
        aWorktree('w1', { branch: 'main', isMain: true }),
        aWorktree('w2', { branch: 'feat' }),
        aWorktree('x1', { projectId: 'p2', isMain: true }),
      ],
    })
    const h = createCliHandlers(makeDeps({ projects }))
    expect(await h.worktreeList({ context: context({ worktreeId: 'w2' }) })).toEqual(
      ok({
        projectId: 'p1',
        worktrees: [
          { id: 'w1', projectId: 'p1', branch: 'main', path: '/wt/w1', isMain: true },
          { id: 'w2', projectId: 'p1', branch: 'feat', path: '/wt/w2', isMain: false },
        ],
      }),
    )
  })

  it('worktreeCreate passes branch/baseBranch/path', async () => {
    const projects = fakeProjects()
    const h = createCliHandlers(makeDeps({ projects }))
    const req = { context: context(), projectId: 'p1', branch: 'b', baseBranch: 'main', path: '/x' }
    expect(await h.worktreeCreate(req)).toMatchObject({ ok: true, result: { branch: 'b' } })
    expect(projects.state.created).toEqual([{ projectId: 'p1', branch: 'b', baseBranch: 'main', path: '/x' }])
  })
})

describe('agent handlers', () => {
  it('agentSpawn starts a session with the resolved profile id and prompt', async () => {
    const agents = fakeAgents()
    const h = createCliHandlers(makeDeps({ agents }))
    const res = await h.agentSpawn({ context: context({ worktreeId: 'w1' }), profile: 'opencode', prompt: 'Go' })
    expect(agents.state.started).toEqual([{ worktreeId: 'w1', profileId: 'oc', initialPrompt: 'Go' }])
    expect(res).toMatchObject({ ok: true, result: { worktreeId: 'w1', profileId: 'oc', profileName: 'OpenCode' } })
  })

  it('agentList maps profile names', async () => {
    const agents = fakeAgents({ sessions: [aSession('s1', 1, { profileId: 'claude', title: 'Fix' })] })
    const h = createCliHandlers(makeDeps({ agents }))
    expect(await h.agentList({ context: context({ worktreeId: 'w1' }) })).toMatchObject({
      ok: true,
      result: { worktreeId: 'w1', sessions: [{ id: 's1', profileName: 'Claude', title: 'Fix', status: 'starting' }] },
    })
  })

  it('profileList maps fields', async () => {
    const h = createCliHandlers(makeDeps())
    expect(await h.profileList({ context: context() })).toEqual(
      ok({
        profiles: [
          { id: 'claude', name: 'Claude', providerId: 'prov', enabled: true, isDefault: false },
          { id: 'oc', name: 'OpenCode', providerId: 'prov', enabled: true, isDefault: false },
        ],
      }),
    )
  })
})

describe('comments handler', () => {
  it('lists the drafts of the worktree; a sent (deleted) comment is absent', async () => {
    const comments = fakeComments([aComment('c1', { lineStart: 2 }), aComment('other', { worktreeId: 'w2' })])
    const h = createCliHandlers(makeDeps({ comments }))
    expect(await h.commentsList({ context: context({ worktreeId: 'w1' }) })).toMatchObject({
      ok: true,
      result: { worktreeId: 'w1', comments: [{ id: 'c1', filePath: 'a.ts', lineStart: 2, lineEnd: null }] },
    })
  })

  it('comments module missing → module_unavailable', async () => {
    const h = createCliHandlers(makeDeps({ comments: undefined }))
    expect(await h.commentsList({ context: context({ worktreeId: 'w1' }) })).toMatchObject({
      ok: false,
      error: { code: 'module_unavailable' },
    })
  })
})

it('invalid payload → invalid_argument', async () => {
  const h = createCliHandlers(makeDeps())
  expect(await h.worktreeCreate({ context: context() })).toMatchObject({ ok: false, error: { code: 'invalid_argument' } })
})

it('an unexpected throw → internal', async () => {
  const projects = fakeProjects({ failCreate: new Error('disk on fire') })
  const h = createCliHandlers(makeDeps({ projects }))
  expect(await h.worktreeCreate({ context: context(), projectId: 'p1', branch: 'b' })).toMatchObject({
    ok: false,
    error: { code: 'internal', message: 'disk on fire' },
  })
})
