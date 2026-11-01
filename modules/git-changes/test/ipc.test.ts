import {
  type BranchInfo,
  GitServiceToken,
  type ProjectsService,
  ProjectsServiceToken,
  type Worktree,
  worktreeChanged,
} from '@pragma/module-projects/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  changesChangedEvent,
  fileContentsIpc,
  GIT_CHANGES_SETTINGS_DEFAULTS,
  type GitChangesSettings,
  listBranchesIpc,
  listChangesIpc,
  setBaseBranchIpc,
} from '../src/contract'
import { DiffService } from '../src/main/diff-service'
import mainModule from '../src/main/index'
import { registerIpc } from '../src/main/ipc'
import {
  buildStandardFixture,
  execGitPort,
  type FakeMainCtx,
  fakeMainCtx,
  STANDARD_EXPECT,
  type StandardFixture,
} from '../testing'

let fx: StandardFixture
let wt: Worktree
let t: FakeMainCtx<GitChangesSettings>
const BRANCHES: BranchInfo[] = [
  { name: 'origin/main', kind: 'remote', checkedOutAt: null },
  { name: 'main', kind: 'local', checkedOutAt: null },
  { name: 'develop', kind: 'local', checkedOutAt: null },
]
const setBaseBranch = vi.fn(async (_id: string, branch: string) => {
  wt = { ...wt, baseBranch: branch }
  return wt
})
const projects = {
  getWorktree: async (id: string) => (id === wt.id ? wt : null),
  listBranches: async () => BRANCHES,
  setBaseBranch,
} as unknown as ProjectsService

const branchPaths = async () => {
  const l = await t.invoke(listChangesIpc, { worktreeId: 'w', mode: 'branch' })
  return l.state === 'ok' ? l.files.map((f) => f.path) : l.state
}

beforeAll(async () => {
  fx = await buildStandardFixture()
})
afterAll(() => fx.repo.cleanup())
beforeEach(() => {
  setBaseBranch.mockClear()
  wt = {
    id: 'w',
    projectId: 'p',
    path: fx.repo.path,
    branch: 'feature',
    baseBranch: 'main',
    isMain: true,
    createdAt: 0,
    archivedAt: null,
  }
  t = fakeMainCtx({ settings: GIT_CHANGES_SETTINGS_DEFAULTS })
  const diff = new DiffService({ git: execGitPort(), maxFileBytes: () => GIT_CHANGES_SETTINGS_DEFAULTS.maxFileBytes })
  registerIpc(t.ctx, {
    diff,
    projects,
    publishChanged: (worktreeId) => t.ctx.ipc.publish(changesChangedEvent, { worktreeId }),
  })
})

describe('git-changes IPC', () => {
  it('list branch returns merge-base..HEAD against the worktree base', async () => {
    expect(await branchPaths()).toEqual(STANDARD_EXPECT.branchVsMain)
  })

  it('setBaseBranch develop goes through projects, publishes changed once and recomputes', async () => {
    await t.invoke(setBaseBranchIpc, { worktreeId: 'w', baseBranch: 'develop' })
    expect(setBaseBranch).toHaveBeenCalledWith('w', 'develop')
    expect(t.publishedOn(changesChangedEvent)).toEqual([{ worktreeId: 'w' }])
    expect(await branchPaths()).toEqual(STANDARD_EXPECT.branchVsDevelop)
  })

  it('listBranches maps to {name, kind}, local first', async () => {
    expect(await t.invoke(listBranchesIpc, { worktreeId: 'w' })).toEqual({
      branches: [
        { name: 'main', kind: 'local' },
        { name: 'develop', kind: 'local' },
        { name: 'origin/main', kind: 'remote' },
      ],
    })
  })

  it('fileContents resolves the worktree base too', async () => {
    const c = await t.invoke(fileContentsIpc, { worktreeId: 'w', mode: 'branch', path: 'docs/added.md', status: 'A' })
    expect([c.old.kind, c.new.kind]).toEqual(['absent', 'text'])
  })

  it('unknown worktree rejects with worktreeNotFound', async () => {
    await expect(t.invoke(listChangesIpc, { worktreeId: 'nope', mode: 'uncommitted' })).rejects.toThrow(
      'worktreeNotFound',
    )
  })

  it('fileContents with a traversal path rejects with a zod error', async () => {
    const input = { worktreeId: 'w', mode: 'uncommitted', path: '../x', status: 'M' }
    await expect(t.invoke(fileContentsIpc, input)).rejects.toMatchObject({ name: 'ZodError' })
  })
})

describe('git-changes main module', () => {
  it('worktree.changed is forwarded as git-changes.changed', async () => {
    const m = fakeMainCtx<GitChangesSettings>({
      settings: GIT_CHANGES_SETTINGS_DEFAULTS,
      services: [
        [GitServiceToken, execGitPort()],
        [ProjectsServiceToken, projects],
      ],
    })
    await mainModule.activate(m.ctx)
    m.emit(worktreeChanged, { worktreeId: 'w', path: fx.repo.path, reason: 'head', changedPaths: [], truncated: false })
    expect(m.publishedOn(changesChangedEvent)).toEqual([{ worktreeId: 'w' }])
    expect(await m.invoke(listChangesIpc, { worktreeId: 'w', mode: 'branch' })).toMatchObject({ state: 'ok' })
  })
})
