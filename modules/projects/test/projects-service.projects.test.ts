import { mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ACTIVE_WORKTREE_STATE_KEY } from '../src/constants'
import { PROJECTS_EVENTS as E } from '../src/contract'
import { codeOf } from './support/cleanups'
import type { FixtureRepo } from './support/git-fixture'
import { makeServiceHarness, type ServiceHarness } from './support/service-harness'

let h: ServiceHarness
let repo: FixtureRepo
beforeEach(async () => {
  h = makeServiceHarness()
  repo = await h.repo()
})
afterEach(() => h.cleanup())

async function addExternal(branch: string): Promise<string> {
  const path = join(h.plainDir(), 'ext')
  await repo.git('worktree', 'add', '-b', branch, path)
  return path
}

describe('addProject', () => {
  it('adds a repo and imports the main checkout', async () => {
    const project = await h.service.addProject(repo.dir)
    expect(project).toMatchObject({ name: repo.dir.split('/').pop(), repoPath: repo.dir, defaultBaseBranch: 'main' })
    const [main, ...rest] = await h.service.listWorktrees(project.id)
    expect(rest).toEqual([])
    expect(main).toMatchObject({ isMain: true, branch: 'main', path: repo.dir, baseBranch: 'main' })
    expect(h.names()).toEqual([E.worktreeCreated, E.worktreeSelected])
    expect(h.service.getActiveWorktreeId()).toBe(main?.id)
    expect(h.stateChanges.count).toBe(1)
  })

  it.each([
    ['a missing path', async () => join(repo.dir, 'missing'), 'pathNotFound'],
    ['a plain dir', async () => h.plainDir(), 'notAGitRepo'],
    ['a bare repo', async () => (await h.clone(repo, { bare: true })).dir, 'bareRepo'],
    [
      'a second add via a symlink',
      async () => {
        await h.service.addProject(repo.dir)
        const link = join(h.plainDir(), 'link')
        symlinkSync(repo.dir, link)
        return link
      },
      'alreadyAdded',
    ],
    [
      'a second add via a subfolder',
      async () => {
        await h.service.addProject(repo.dir)
        mkdirSync(join(repo.dir, 'sub'))
        return join(repo.dir, 'sub')
      },
      'alreadyAdded',
    ],
  ])('rejects %s', async (_name, input, code) => {
    expect(await codeOf(h.service.addProject(await input()))).toBe(code)
  })

  it('adding a linked worktree folder adds its main repo and imports both', async () => {
    const linked = await addExternal('feat/linked')
    const project = await h.service.addProject(linked)
    expect(project.repoPath).toBe(repo.dir)
    const rows = await h.service.listWorktrees(project.id)
    expect(rows.map((w) => [w.branch, w.isMain])).toEqual([
      ['main', true],
      ['feat/linked', false],
    ])
  })

  it('re-adding a removed project keeps its id; remove emits project.removed and leaves disk intact', async () => {
    const first = await h.service.addProject(repo.dir)
    h.clearEvents()
    await h.service.removeProject(first.id)
    expect(h.names()).toEqual([E.worktreeRemoved, E.worktreeSelected, E.projectRemoved])
    expect(h.events[0]?.payload).toMatchObject({ reason: 'projectRemoved' })
    expect(h.events[2]?.payload).toEqual({ projectId: first.id, repoPath: repo.dir })
    expect(await h.service.listProjects()).toEqual([])
    expect(h.service.getActiveWorktreeId()).toBeNull()
    expect(await repo.git('status', '--porcelain')).toBe('')
    const again = await h.service.addProject(repo.dir)
    expect(again.id).toBe(first.id)
  })
})

describe('syncProject', () => {
  let projectId: string
  beforeEach(async () => {
    projectId = (await h.service.addProject(repo.dir)).id
    h.clearEvents()
    h.stateChanges.count = 0
  })
  const branches = async () => (await h.service.listWorktrees(projectId)).map((w) => w.branch)

  it('imports an externally added worktree', async () => {
    const path = await addExternal('ext')
    await h.service.syncProject(projectId)
    expect(await branches()).toEqual(['main', 'ext'])
    expect(h.events).toEqual([{ name: E.worktreeCreated, payload: { worktree: expect.objectContaining({ path }) } }])
    expect(h.stateChanges.count).toBe(1)
  })

  it('does nothing (no state push) when nothing changed', async () => {
    await h.service.syncProject(projectId)
    expect(h.events).toEqual([])
    expect(h.stateChanges.count).toBe(0)
  })

  it('archives an externally removed worktree and reselects main', async () => {
    const path = await addExternal('ext')
    await h.service.syncProject(projectId)
    const ext = (await h.service.listWorktrees(projectId))[1]
    await h.service.setActiveWorktree(ext?.id ?? null)
    await repo.git('worktree', 'remove', '--force', path)
    h.clearEvents()
    await h.service.syncProject(projectId)
    expect(await branches()).toEqual(['main'])
    expect(h.names()).toEqual([E.worktreeRemoved, E.worktreeSelected])
    expect(h.events[0]?.payload).toMatchObject({ worktreeId: ext?.id, reason: 'external' })
    const main = (await h.service.listWorktrees(projectId))[0]
    expect(h.service.getActiveWorktreeId()).toBe(main?.id)
    expect((await h.service.getWorktree(ext?.id ?? ''))?.archivedAt).not.toBeNull()
  })

  it("archives a worktree whose folder was rm -rf'd", async () => {
    const path = await addExternal('ext')
    await h.service.syncProject(projectId)
    rmSync(path, { recursive: true, force: true })
    await h.service.syncProject(projectId)
    expect(await branches()).toEqual(['main'])
  })

  it('updates the branch after an external checkout', async () => {
    const path = await addExternal('ext')
    await h.service.syncProject(projectId)
    await repo.git('-C', path, 'checkout', '-b', 'renamed')
    await h.service.syncProject(projectId)
    expect(await branches()).toEqual(['main', 'renamed'])
  })

  it('records a sync failure in projectErrors instead of throwing, and clears it on success', async () => {
    rmSync(join(repo.dir, '.git'), { recursive: true, force: true })
    await h.service.syncProject(projectId)
    expect((await h.service.getSnapshot()).projectErrors).toEqual({ [projectId]: 'gitFailed' })
    h.service.setProjectError(projectId, null)
    expect((await h.service.getSnapshot()).projectErrors).toEqual({})
  })
})

describe('active worktree, order, base branch, snapshot', () => {
  it('the active worktree survives a new service instance on the same DB; a stale id yields null', async () => {
    const project = await h.service.addProject(repo.dir)
    const active = h.service.getActiveWorktreeId()
    expect(h.newService().getActiveWorktreeId()).toBe(active)
    h.db.repo.setState(ACTIVE_WORKTREE_STATE_KEY, 'stale')
    expect(h.newService().getActiveWorktreeId()).toBeNull()
    expect(project).toBeDefined()
  })

  it('setActiveWorktree rejects unknown ids and emits only on change', async () => {
    await h.service.addProject(repo.dir)
    const active = h.service.getActiveWorktreeId()
    h.clearEvents()
    expect(await codeOf(h.service.setActiveWorktree('nope'))).toBe('worktreeNotFound')
    await h.service.setActiveWorktree(active)
    expect(h.events).toEqual([])
    await h.service.setActiveWorktree(null)
    expect(h.events).toEqual([{ name: E.worktreeSelected, payload: { worktreeId: null, previousWorktreeId: active } }])
  })

  it('reorderProjects persists order', async () => {
    const other = await h.repo()
    const a = await h.service.addProject(repo.dir)
    const b = await h.service.addProject(other.dir)
    await h.service.reorderProjects([b.id, a.id])
    expect((await h.newService().listProjects()).map((p) => p.id)).toEqual([b.id, a.id])
  })

  it('setBaseBranch updates and emits worktree.changed(baseBranch); an unknown ref is branchNotFound', async () => {
    const project = await h.service.addProject(repo.dir)
    await repo.git('branch', 'dev')
    const [main] = await h.service.listWorktrees(project.id)
    const id = main?.id ?? ''
    h.clearEvents()
    expect(await h.service.setBaseBranch(id, 'dev')).toMatchObject({ id, baseBranch: 'dev' })
    expect(h.events).toEqual([
      {
        name: E.worktreeChanged,
        payload: { worktreeId: id, path: repo.dir, reason: 'baseBranch', changedPaths: [], truncated: false },
      },
    ])
    expect(await codeOf(h.service.setBaseBranch(id, 'nope'))).toBe('branchNotFound')
    expect(await codeOf(h.service.setBaseBranch('nope', 'dev'))).toBe('worktreeNotFound')
  })

  it('getSnapshot reports counts and sync state of live worktrees only', async () => {
    const project = await h.service.addProject(repo.dir)
    const [main] = await h.service.listWorktrees(project.id)
    const id = main?.id ?? ''
    h.counts.set(id, 3)
    h.sync.set(id, { upstream: null, ahead: null, behind: null })
    const snap = await h.service.getSnapshot()
    expect(snap).toMatchObject({
      projects: [project],
      changedFiles: { [id]: 3 },
      sync: { [id]: { upstream: null } },
      activeWorktreeId: id,
    })
    expect(h.service.getChangedFileCount(id)).toBe(3)
  })
})
