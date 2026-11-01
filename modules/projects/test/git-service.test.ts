import { existsSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { GitService } from '../src/contract'
import { createGitService } from '../src/main/git/git-service'
import { defaultExec, type ExecFn } from '../src/main/git/run'
import { codeOf, createCleanups } from './support/cleanups'
import { type FixtureRepo, gitTestEnv, makeClone, makePlainDir, makeRepo } from './support/git-fixture'

let git: GitService
let repo: FixtureRepo
const cleanups = createCleanups()
const track = cleanups.track

beforeEach(async () => {
  git = createGitService({ baseEnv: gitTestEnv() })
  repo = track(await makeRepo())
})
afterEach(() => cleanups.run())

async function addLinked(branch: string): Promise<string> {
  const path = join(makePlainDirTracked(), 'wt')
  await repo.git('worktree', 'add', '-b', branch, path)
  return path
}

describe('resolveRepo', () => {
  it.each([
    [
      'a subfolder',
      async () => {
        mkdirSync(join(repo.dir, 'sub', 'deep'), { recursive: true })
        return join(repo.dir, 'sub', 'deep')
      },
    ],
    ['a linked worktree', () => addLinked('feat/link')],
    [
      'a symlinked path',
      async () => {
        const link = join(makePlainDirTracked(), 'link')
        symlinkSync(repo.dir, link)
        return link
      },
    ],
  ])('%s resolves to the main realpath', async (_name, input) => {
    expect(await git.resolveRepo(await input())).toEqual({ repoPath: repo.dir, isBare: false })
  })

  it('a plain dir is null and a missing path is null', async () => {
    expect(await git.resolveRepo(makePlainDirTracked())).toBeNull()
    expect(await git.resolveRepo(join(repo.dir, 'nope'))).toBeNull()
  })

  it('a bare repo is reported as bare', async () => {
    const bare = track(await makeClone(repo, { bare: true }))
    expect(await git.resolveRepo(bare.dir)).toEqual({ repoPath: bare.dir, isBare: true })
  })
})

function makePlainDirTracked(): string {
  return track(makePlainDir()).dir
}

describe('defaultBaseBranch', () => {
  it('uses the origin HEAD target, falling back to origin/<n> without a local branch', async () => {
    const origin = track(await makeRepo({ branch: 'trunk' }))
    const clone = track(await makeClone(origin))
    expect(await git.defaultBaseBranch(clone.dir)).toBe('trunk')
    await clone.git('checkout', '--detach')
    await clone.git('branch', '-D', 'trunk')
    expect(await git.defaultBaseBranch(clone.dir)).toBe('origin/trunk')
  })

  it.each([
    ['master', 'master'],
    ['dev', 'dev'],
  ])('a repo with only %s → %s', async (branch, expected) => {
    const r = track(await makeRepo({ branch }))
    expect(await git.defaultBaseBranch(r.dir)).toBe(expected)
  })

  it('prefers main over the current branch', async () => {
    await repo.git('checkout', '-b', 'other')
    expect(await git.defaultBaseBranch(repo.dir)).toBe('main')
  })
})

describe('status', () => {
  it('is clean on a fresh repo', async () => {
    expect(await git.status(repo.dir)).toMatchObject({ branch: 'main', upstream: null, entries: [] })
  })

  it('reports ordinary, untracked and renamed entries; only status sets GIT_OPTIONAL_LOCKS', async () => {
    const calls: { args: string[]; locks: string | undefined }[] = []
    const exec: ExecFn = (file, args, o) => {
      calls.push({ args, locks: o.env.GIT_OPTIONAL_LOCKS })
      return defaultExec(file, args, o)
    }
    const spied = createGitService({ baseEnv: gitTestEnv(), exec })
    await repo.write('old.txt', 'x\n')
    await repo.commitAll('add old')
    await repo.git('mv', 'old.txt', 'new.txt')
    await repo.write('README.md', 'changed\n')
    await repo.write('a/b/c.txt', 'new\n')
    const s = await spied.status(repo.dir)
    expect(s.entries.map((e) => e.kind).sort()).toEqual(['ordinary', 'renamed', 'untracked'])
    expect(s.entries.find((e) => e.kind === 'renamed')).toMatchObject({ path: 'new.txt', origPath: 'old.txt' })
    await spied.refExists(repo.dir, 'main')
    expect(calls.map((c) => [c.args.includes('status'), c.locks])).toEqual([
      [true, '0'],
      [false, undefined],
    ])
  })
})

describe('worktrees', () => {
  it('gitDirs of a linked worktree points into the common dir', async () => {
    const path = await addLinked('feat/dirs')
    const dirs = await git.gitDirs(path)
    expect(dirs.commonDir).toBe(join(repo.dir, '.git'))
    expect(dirs.gitDir.startsWith(join(repo.dir, '.git', 'worktrees'))).toBe(true)
  })

  it('worktreeAdd creates nested parents; adding a checked-out branch fails', async () => {
    const path = join(makePlainDirTracked(), 'a', 'b', 'feat-x')
    await git.worktreeAdd(repo.dir, { path, branch: 'feat/x', newBranch: true, startPoint: 'main' })
    expect(existsSync(join(path, 'README.md'))).toBe(true)
    expect(await git.worktreeList(repo.dir)).toHaveLength(2)
    const again = join(makePlainDirTracked(), 'again')
    expect(await codeOf(git.worktreeAdd(repo.dir, { path: again, branch: 'feat/x', newBranch: false }))).toBe(
      'branchCheckedOut',
    )
  })

  it('worktreeRemove needs force for a dirty worktree', async () => {
    const path = await addLinked('feat/dirty')
    writeFileSync(join(path, 'dirty.txt'), 'x')
    expect(await codeOf(git.worktreeRemove(repo.dir, path, { force: false }))).toBe('gitFailed')
    await git.worktreeRemove(repo.dir, path, { force: true })
    expect(existsSync(path)).toBe(false)
  })
})

describe('branches and refs', () => {
  it('branchList shows checkout locations; branchDelete needs force for unmerged', async () => {
    const path = await addLinked('feat/x')
    expect(await git.branchList(repo.dir)).toContainEqual({ name: 'feat/x', kind: 'local', checkedOutAt: path })
    await repo.git('-C', path, 'commit', '--allow-empty', '-m', 'unmerged')
    await git.worktreeRemove(repo.dir, path, { force: true })
    expect(await codeOf(git.branchDelete(repo.dir, 'feat/x', { force: false }))).toBe('gitFailed')
    await git.branchDelete(repo.dir, 'feat/x', { force: true })
    expect(await git.refExists(repo.dir, 'feat/x')).toBe(false)
  })

  it('mergeBase, countCommits, refExists', async () => {
    const tip = await repo.git('rev-parse', 'HEAD')
    const path = await addLinked('feat/x')
    await repo.git('-C', path, 'commit', '--allow-empty', '-m', 'one')
    expect(await git.mergeBase(repo.dir, 'main', 'feat/x')).toBe(tip)
    expect(await git.countCommits(repo.dir, 'main', 'feat/x')).toBe(1)
    expect(await git.refExists(repo.dir, 'main')).toBe(true)
    expect(await git.refExists(repo.dir, 'nope')).toBe(false)
  })

  it('show returns content or null', async () => {
    expect(await git.show(repo.dir, 'HEAD', 'README.md')).toBe('# fixture\n')
    expect(await git.show(repo.dir, 'HEAD', 'nope')).toBeNull()
  })

  it.each([
    ['feat/ok', true],
    ['bad..name', false],
    ['-x', false],
  ])('isValidBranchName(%s) = %s', async (name, valid) => {
    expect(await git.isValidBranchName(repo.dir, name)).toBe(valid)
  })
})

describe('errors', () => {
  it('a missing git binary is gitNotFound', async () => {
    const missing = createGitService({ gitBinary: '/nonexistent/git' })
    expect(await codeOf(missing.status(repo.dir))).toBe('gitNotFound')
  })
})
