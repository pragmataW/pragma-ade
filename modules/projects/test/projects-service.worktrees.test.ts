import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PROJECTS_EVENTS as E, type Project } from '../src/contract'
import { codeOf } from './support/cleanups'
import type { FixtureRepo } from './support/git-fixture'
import { makeServiceHarness, type ServiceHarness } from './support/service-harness'

let h: ServiceHarness
let repo: FixtureRepo
let project: Project
const removed: string[] = []

beforeEach(async () => {
  removed.splice(0)
  h = makeServiceHarness({ beforeRemove: async (id) => void removed.push(id) })
  repo = await h.repo()
  project = await h.service.addProject(repo.dir)
  h.clearEvents()
})
afterEach(() => h.cleanup())

const slug = () => repo.dir.split('/').pop()?.toLowerCase() ?? ''
const mainId = async () => (await h.service.listWorktrees(project.id))[0]?.id ?? ''

describe('branches and path suggestions', () => {
  it('listBranches includes local and remote branches with checkout locations', async () => {
    const clone = await h.clone(repo)
    await repo.git('branch', 'dev')
    const cloned = await h.service.addProject(clone.dir)
    const branches = await h.service.listBranches(cloned.id)
    expect(branches).toContainEqual({ name: 'main', kind: 'local', checkedOutAt: clone.dir })
    expect(branches).toContainEqual({ name: 'origin/main', kind: 'remote', checkedOutAt: null })
  })

  it('suggests <root>/<project-slug>/<branch-slug> and de-duplicates', async () => {
    const first = await h.service.suggestWorktreePath(project.id, 'feat/Login Page')
    expect(first).toBe(join(h.settings.worktreesRoot, slug(), 'feat-login-page'))
    mkdirSync(first, { recursive: true })
    expect(await h.service.suggestWorktreePath(project.id, 'feat/Login Page')).toBe(`${first}-2`)
  })
})

describe('createWorktree', () => {
  it.each([
    ['a new branch from the default base', async () => 'feat/new'],
    [
      'an existing local branch',
      async () => {
        await repo.git('branch', 'existing')
        return 'existing'
      },
    ],
  ])('creates %s', async (_name, prepare) => {
    const branch = await prepare()
    const w = await h.service.createWorktree({ projectId: project.id, branch })
    expect(existsSync(join(w.path, 'README.md'))).toBe(true)
    expect(w).toMatchObject({ branch, isMain: false, baseBranch: 'main', projectId: project.id })
    expect(await repo.git('merge-base', 'main', branch)).toBe(await repo.git('rev-parse', 'main'))
    expect(h.names()).toEqual([E.worktreeCreated])
    expect(h.service.getActiveWorktreeId()).toBe(await mainId())
  })

  it('creates a local branch from a remote-only origin/<branch>', async () => {
    await repo.git('branch', 'dev')
    const clone = await h.clone(repo)
    const cloned = await h.service.addProject(clone.dir)
    const w = await h.service.createWorktree({ projectId: cloned.id, branch: 'dev' })
    expect(w.branch).toBe('dev')
    expect(await clone.git('-C', w.path, 'rev-parse', '--abbrev-ref', '@{upstream}')).toBe('origin/dev')
  })

  it.each([
    ['bad..name', undefined, 'invalidBranchName'],
    ['main', undefined, 'branchCheckedOut'],
    ['feat/x', 'nonEmpty', 'pathExists'],
  ])('rejects branch %s (path %s) with %s', async (branch, pathKind, code) => {
    let path: string | undefined
    if (pathKind) {
      path = h.plainDir()
      writeFileSync(join(path, 'x.txt'), 'x')
    }
    expect(await codeOf(h.service.createWorktree({ projectId: project.id, branch, path }))).toBe(code)
  })

  it('two parallel createWorktree calls on one repo both succeed', async () => {
    const [a, b] = await Promise.all([
      h.service.createWorktree({ projectId: project.id, branch: 'para/a' }),
      h.service.createWorktree({ projectId: project.id, branch: 'para/b' }),
    ])
    expect(existsSync(a.path) && existsSync(b.path)).toBe(true)
    expect(await h.service.listWorktrees(project.id)).toHaveLength(3)
  })
})

describe('removal', () => {
  it('getRemovalInfo reports changed files and unmerged commits', async () => {
    const w = await h.service.createWorktree({ projectId: project.id, branch: 'feat/info' })
    await repo.git('-C', w.path, 'commit', '--allow-empty', '-m', 'ahead')
    writeFileSync(join(w.path, 'dirty.txt'), 'x')
    expect(await h.service.getRemovalInfo(w.id)).toEqual({
      worktreeId: w.id,
      isMain: false,
      branch: 'feat/info',
      changedFiles: 1,
      unmergedCommits: 1,
    })
  })

  it('refuses to remove the main checkout', async () => {
    expect(await codeOf(h.service.removeWorktree(await mainId(), { deleteBranch: false }))).toBe('cannotRemoveMain')
  })

  it('removes a dirty worktree, deletes its branch on request, reselects main', async () => {
    const w = await h.service.createWorktree({ projectId: project.id, branch: 'feat/gone' })
    await h.service.setActiveWorktree(w.id)
    writeFileSync(join(w.path, 'dirty.txt'), 'x')
    h.clearEvents()
    await h.service.removeWorktree(w.id, { deleteBranch: true })
    expect(existsSync(w.path)).toBe(false)
    expect(await h.git.refExists(repo.dir, 'refs/heads/feat/gone')).toBe(false)
    expect(removed).toEqual([w.id])
    expect(h.names()).toEqual([E.worktreeRemoved, E.worktreeSelected])
    expect(h.events[0]?.payload).toMatchObject({ worktreeId: w.id, reason: 'user' })
    expect(h.service.getActiveWorktreeId()).toBe(await mainId())
    expect(await h.service.listWorktrees(project.id)).toHaveLength(1)
  })

  it('keeps the branch when not asked to delete it', async () => {
    const w = await h.service.createWorktree({ projectId: project.id, branch: 'feat/keep' })
    await h.service.removeWorktree(w.id, { deleteBranch: false })
    expect(await h.git.refExists(repo.dir, 'refs/heads/feat/keep')).toBe(true)
  })

  it('removing a worktree whose folder is already gone succeeds', async () => {
    const w = await h.service.createWorktree({ projectId: project.id, branch: 'feat/vanished' })
    rmSync(w.path, { recursive: true, force: true })
    await h.service.removeWorktree(w.id, { deleteBranch: true })
    expect(await h.git.worktreeList(repo.dir)).toHaveLength(1)
    expect(await h.service.listWorktrees(project.id)).toHaveLength(1)
  })
})
