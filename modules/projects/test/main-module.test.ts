import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GitServiceToken, PROJECTS_COMMANDS, projectsIpc, projectsIpcEvents, type Worktree } from '../src/contract'
import { createCleanups } from './support/cleanups'
import { type FixtureRepo, makeClone, makePlainDir, makeRepo } from './support/git-fixture'
import { type ProjectsHost, startProjectsHost } from './support/main-harness'
import { sleep, waitFor } from './support/wait'

const STATUS_WAIT_MS = 3000
const cleanups = createCleanups()
let h: ProjectsHost
let repo: FixtureRepo
beforeEach(async () => {
  h = await startProjectsHost()
  repo = cleanups.track(await makeRepo())
})
afterEach(async () => {
  await h.dispose()
  cleanups.run()
})

const unwrap = <T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(`unexpected error result ${JSON.stringify(r.error)}`)
  return r.value
}
const addRepo = async (dir: string) => unwrap(await h.t.ipc.invoke(projectsIpc.addProject, { path: dir }))
async function createWorktree(projectId: string, branch: string): Promise<Worktree> {
  return unwrap(await h.t.ipc.invoke(projectsIpc.createWorktree, { projectId, branch }))
}
const statusOf = (id: string, pred: (s: ProjectsHost['statuses'][number]) => boolean) =>
  waitFor(() => h.statuses.find((s) => s.worktreeId === id && pred(s)), STATUS_WAIT_MS)

describe('projects main module', () => {
  it('registers every IPC channel, both tokens and the selectWorktree command', async () => {
    for (const c of Object.values(projectsIpc)) expect(h.t.host.router.has(c.channel)).toBe(true)
    expect(h.ctx.services.get(GitServiceToken)).toBeDefined()
    expect(h.service.listProjects).toBeTypeOf('function')
    expect(h.t.host.commands.has(PROJECTS_COMMANDS.selectWorktree)).toBe(true)
  })

  it('addProject returns ok and publishes stateChanged; a plain dir is an err result', async () => {
    const project = await addRepo(repo.dir)
    expect(project.repoPath).toBe(repo.dir)
    await waitFor(() => h.stateChanges.count > 0)
    const plain = cleanups.track(makePlainDir())
    expect(await h.t.ipc.invoke(projectsIpc.addProject, { path: plain.dir })).toEqual({
      ok: false,
      error: { code: 'notAGitRepo', detail: plain.dir },
    })
  })

  it('pickFolder returns the dialog path or null on cancel', async () => {
    h.dialogReplies.openFolder = '/picked'
    expect(await h.t.ipc.invoke(projectsIpc.pickFolder, undefined)).toEqual({ path: '/picked' })
    h.dialogReplies.openFolder = null
    expect(await h.t.ipc.invoke(projectsIpc.pickFolder, undefined)).toEqual({ path: null })
  })

  it('createWorktree selects the new worktree and publishes selected', async () => {
    const selected: (string | null)[] = []
    h.t.ipc.subscribe(projectsIpcEvents.selected, (p) => void selected.push(p.worktreeId))
    const project = await addRepo(repo.dir)
    const w = await createWorktree(project.id, 'feat/wired')
    expect(h.service.getActiveWorktreeId()).toBe(w.id)
    await waitFor(() => selected.includes(w.id))
    expect(await h.t.host.commands.execute(PROJECTS_COMMANDS.selectWorktree, { worktreeId: null })).toBeUndefined()
    expect(h.service.getActiveWorktreeId()).toBeNull()
  })

  it('a file write emits worktree.changed(files) and statusChanged; a commit emits head and resets', async () => {
    const project = await addRepo(repo.dir)
    const w = await createWorktree(project.id, 'feat/watch')
    await statusOf(w.id, (s) => s.changedFiles === 0)
    writeFileSync(join(w.path, 'new.txt'), 'x')
    await statusOf(w.id, (s) => s.changedFiles === 1)
    await waitFor(() =>
      h.changed.find((c) => c.worktreeId === w.id && c.reason === 'files' && c.changedPaths.includes('new.txt')),
    )
    h.statuses.splice(0)
    await repo.git('-C', w.path, 'add', '-A')
    await repo.git('-C', w.path, 'commit', '-m', 'wired')
    await statusOf(w.id, (s) => s.changedFiles === 0)
    await waitFor(() => h.changed.find((c) => c.worktreeId === w.id && c.reason === 'head'))
  })

  it('a commit in a clone with an upstream publishes ahead 1', async () => {
    const clone = cleanups.track(await makeClone(repo))
    const project = await addRepo(clone.dir)
    const [main] = await h.service.listWorktrees(project.id)
    const id = main?.id ?? ''
    await statusOf(id, (s) => s.ahead === 0)
    await clone.commitAll('ahead')
    expect(await statusOf(id, (s) => s.ahead === 1)).toMatchObject({ upstream: 'origin/main', ahead: 1, behind: 0 })
  })

  it('one file write triggers at most two status runs (no self-trigger)', async () => {
    const project = await addRepo(repo.dir)
    const [main] = await h.service.listWorktrees(project.id)
    await statusOf(main?.id ?? '', () => true)
    await sleep(500)
    h.statusCalls.count = 0
    writeFileSync(join(repo.dir, 'once.txt'), 'x')
    await sleep(1500)
    expect(h.statusCalls.count).toBeGreaterThan(0)
    expect(h.statusCalls.count).toBeLessThanOrEqual(2)
  })

  it('updateSettings validates and stores', async () => {
    expect(await h.t.ipc.invoke(projectsIpc.updateSettings, { worktreesRoot: 'relative' })).toMatchObject({
      ok: false,
      error: { code: 'invalidSettings' },
    })
    expect(await h.t.ipc.invoke(projectsIpc.updateSettings, { worktreesRoot: '~/other' })).toEqual({
      ok: true,
      value: { worktreesRoot: '~/other' },
    })
    expect(await h.t.ipc.invoke(projectsIpc.getSettings, undefined)).toEqual({ worktreesRoot: '~/other' })
  })
})
