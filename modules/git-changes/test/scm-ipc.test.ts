import {
  GitServiceToken,
  type ProjectsService,
  ProjectsServiceToken,
  type Worktree,
} from '@pragma/module-projects/contract'
import { afterEach, describe, expect, it } from 'vitest'
import {
  changesChangedEvent,
  type DestructiveSnapshot,
  GIT_CHANGES_SETTINGS_DEFAULTS,
  type GitChangesSettings,
  GitScmHooksToken,
  scmCommitIpc,
  scmDiscardIpc,
  scmHunksIpc,
  scmStageIpc,
  scmStashFilesIpc,
  scmStashListIpc,
  scmStashPushIpc,
  scmStateIpc,
} from '../src/contract'
import mainModule from '../src/main/index'
import { buildStandardFixture, execGitPort, fakeMainCtx, type StandardFixture } from '../testing'

let fx: StandardFixture | undefined
afterEach(() => fx?.repo.cleanup())

async function activate() {
  fx = await buildStandardFixture()
  const wt = { id: 'w', path: fx.repo.path, baseBranch: 'main' } as Worktree
  const projects = { getWorktree: async (id: string) => (id === 'w' ? wt : null) } as unknown as ProjectsService
  const m = fakeMainCtx<GitChangesSettings>({
    settings: GIT_CHANGES_SETTINGS_DEFAULTS,
    services: [
      [GitServiceToken, execGitPort()],
      [ProjectsServiceToken, projects],
    ],
  })
  await mainModule.activate(m.ctx)
  return { m, repo: fx.repo }
}

describe('git-changes scm IPC', () => {
  it('stage and commit go through the worktree path and publish changed', async () => {
    const { m, repo } = await activate()
    expect(await m.invoke(scmStageIpc, { worktreeId: 'w', paths: ['src/app.ts'] })).toEqual({ ok: true })
    expect(m.publishedOn(changesChangedEvent)).toEqual([{ worktreeId: 'w' }])
    const commit = { worktreeId: 'w', message: 'scm', amend: false, signoff: false, stageAll: false }
    expect(await m.invoke(scmCommitIpc, commit)).toEqual({ ok: true })
    expect(repo.git('log', '-1', '--format=%s')).toBe('scm')
    expect(await m.invoke(scmStateIpc, { worktreeId: 'w' })).toMatchObject({ branch: 'feature', hasHead: true })
  })

  it('hunks, stash list and stash files', async () => {
    const { m } = await activate()
    const { hunks } = await m.invoke(scmHunksIpc, { worktreeId: 'w', path: 'src/app.ts', staged: false })
    expect(hunks.map((h) => h.header)).toEqual(['@@ -7,9 +7,9 @@'])
    const push = { worktreeId: 'w', message: 'wip', includeUntracked: true, staged: false }
    expect(await m.invoke(scmStashPushIpc, push)).toEqual({ ok: true })
    const { stashes } = await m.invoke(scmStashListIpc, { worktreeId: 'w' })
    expect(stashes.map((s) => s.message)).toEqual(['On feature: wip'])
    const { files } = await m.invoke(scmStashFilesIpc, { worktreeId: 'w', sha: stashes[0]?.sha ?? '' })
    expect(files.map((f) => f.path)).toContain('notes/todo.txt')
  })

  it('provides GitScmHooksToken: handlers see a discard before it happens', async () => {
    const { m } = await activate()
    const seen: DestructiveSnapshot[] = []
    m.ctx.services.get(GitScmHooksToken).onBeforeDestructive((s) => void seen.push(s))
    expect(await m.invoke(scmDiscardIpc, { worktreeId: 'w', paths: ['notes/todo.txt'] })).toEqual({ ok: true })
    expect(seen.map((s) => [s.reason, s.paths])).toEqual([['cleanUntracked', ['notes/todo.txt']]])
  })

  it('an unknown worktree rejects; an option-like sha is refused by the schema', async () => {
    const { m } = await activate()
    await expect(m.invoke(scmStageIpc, { worktreeId: 'nope' })).rejects.toThrow('worktreeNotFound')
    await expect(m.invoke(scmStashFilesIpc, { worktreeId: 'w', sha: '--output=x' })).rejects.toMatchObject({
      name: 'ZodError',
    })
  })
})
