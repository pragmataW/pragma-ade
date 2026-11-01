import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ProjectsRepo } from '../src/main/repo'
import { aProject, aWorktree, makeTestDb } from './support/builders'

let db: ReturnType<typeof makeTestDb>
let repo: ProjectsRepo
beforeEach(() => {
  db = makeTestDb()
  repo = db.repo
})
afterEach(() => db.cleanup())

const ids = (rows: { id: string }[]) => rows.map((r) => r.id)

describe('ProjectsRepo projects', () => {
  it('appends on insert and persists setProjectOrder (unlisted ids keep their order)', () => {
    for (const id of ['a', 'b', 'c', 'd']) repo.insertProject(aProject({ id }))
    expect(ids(repo.listProjects())).toEqual(['a', 'b', 'c', 'd'])
    repo.setProjectOrder(['c', 'a'])
    expect(ids(repo.listProjects())).toEqual(['c', 'a', 'b', 'd'])
  })

  it('archives and unarchives (moved last, archivedAt visible by path)', () => {
    for (const id of ['a', 'b']) repo.insertProject(aProject({ id }))
    repo.archiveProject('a', 123)
    expect(ids(repo.listProjects())).toEqual(['b'])
    expect(repo.getProject('a')).toBeNull()
    expect(repo.findProjectByPath('/repos/a')).toMatchObject({ id: 'a', archivedAt: 123 })
    repo.unarchiveProject('a')
    expect(ids(repo.listProjects())).toEqual(['b', 'a'])
    expect(repo.findProjectByPath('/repos/a')?.archivedAt).toBeNull()
    expect(repo.findProjectByPath('/nope')).toBeNull()
  })
})

describe('ProjectsRepo worktrees', () => {
  beforeEach(() => repo.insertProject(aProject({ id: 'p' })))

  it('lists main first then by creation; archived rows are hidden but readable', () => {
    repo.insertWorktree(aWorktree('p', { id: 'w1', createdAt: 1 }))
    repo.insertWorktree(aWorktree('p', { id: 'main', isMain: true, createdAt: 5 }))
    repo.insertWorktree(aWorktree('p', { id: 'w2', createdAt: 3 }))
    expect(ids(repo.listWorktrees('p'))).toEqual(['main', 'w1', 'w2'])
    repo.archiveWorktree('w1', 9)
    expect(ids(repo.listWorktrees('p'))).toEqual(['main', 'w2'])
    expect(ids(repo.listAllLiveWorktrees())).toEqual(['main', 'w2'])
    expect(repo.getWorktree('w1')).toMatchObject({ id: 'w1', archivedAt: 9 })
    expect(repo.getWorktree('main')?.isMain).toBe(true)
    expect(repo.getWorktree('nope')).toBeNull()
  })

  it('the live path is unique until the row is archived', () => {
    repo.insertWorktree(aWorktree('p', { id: 'w1', path: '/same' }))
    expect(() => repo.insertWorktree(aWorktree('p', { id: 'w2', path: '/same' }))).toThrow()
    repo.archiveWorktree('w1', 1)
    expect(() => repo.insertWorktree(aWorktree('p', { id: 'w3', path: '/same' }))).not.toThrow()
  })

  it('updates branch and base branch', () => {
    repo.insertWorktree(aWorktree('p', { id: 'w' }))
    repo.updateWorktreeBranch('w', null)
    repo.updateWorktreeBaseBranch('w', 'origin/dev')
    expect(repo.getWorktree('w')).toMatchObject({ branch: null, baseBranch: 'origin/dev', isMain: false })
  })

  it('hides worktrees of archived projects from listAllLiveWorktrees', () => {
    repo.insertWorktree(aWorktree('p', { id: 'w' }))
    repo.archiveProject('p', 1)
    expect(repo.listAllLiveWorktrees()).toEqual([])
  })
})

describe('ProjectsRepo state', () => {
  it('sets, reads and clears values', () => {
    expect(repo.getState('k')).toBeNull()
    repo.setState('k', 'v')
    expect(repo.getState('k')).toBe('v')
    repo.setState('k', null)
    expect(repo.getState('k')).toBeNull()
  })
})
