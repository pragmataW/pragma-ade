import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { ChangeList, ChangeMode, OkChangeList } from '../src/contract'
import { DiffService } from '../src/main/diff-service'
import { buildEmptyFixture, buildStandardFixture, execGitPort, STANDARD_EXPECT, type StandardFixture } from '../testing'

const MAX = 1_048_576
const service = new DiffService({ git: execGitPort(), maxFileBytes: () => MAX })
let fx: StandardFixture
const extra: StandardFixture[] = []

const list = (mode: ChangeMode, baseBranch = 'main', f: StandardFixture = fx) =>
  service.listChanges({ worktreeId: 'w', cwd: f.repo.path, mode, baseBranch })
function ok(l: ChangeList): OkChangeList {
  if (l.state !== 'ok') throw new Error(`expected ok, got ${l.state}`)
  return l
}
const paths = (l: ChangeList) => ok(l).files.map((f) => f.path)
const byPath = (l: ChangeList, p: string) => ok(l).files.find((f) => f.path === p)

beforeAll(async () => {
  fx = await buildStandardFixture()
  return () => fx.repo.cleanup()
})
afterEach(() => {
  for (const f of extra.splice(0)) f.repo.cleanup()
})

describe('DiffService.listChanges', () => {
  it('uncommitted mode lists staged, unstaged and untracked', async () => {
    const l = await list('uncommitted')
    expect(paths(l)).toEqual(STANDARD_EXPECT.uncommitted)
    expect(ok(l).files.map((f) => f.status)).toEqual(['M', 'M', 'U', 'M'])
    expect(byPath(l, 'assets/logo.png')?.binary).toBe(true)
    expect(byPath(l, 'notes/todo.txt')).toMatchObject({ additions: 2, deletions: 0, binary: false })
    expect(byPath(l, 'src/app.ts')).toMatchObject({ additions: 3, deletions: 3 })
    expect(ok(l)).toMatchObject({ mergeBase: null, commitCount: null, headSha: fx.repo.git('rev-parse', 'HEAD') })
  })

  it('uncommitted mode splits staged (HEAD ↔ index) from unstaged (index ↔ worktree) entries', async () => {
    const l = ok(await list('uncommitted'))
    expect(l.files.filter((f) => f.staged).map((f) => f.path)).toEqual(['README.md'])
    expect(byPath(l, 'README.md')).toMatchObject({ staged: true, status: 'M', additions: 2, deletions: 0 })
    expect(byPath(l, 'src/app.ts')?.staged).toBeUndefined()
  })

  it('a partially staged file is listed in both groups, staged entries first', async () => {
    const f = await buildStandardFixture()
    extra.push(f)
    await f.write('src/app.ts', 'staged\n')
    f.repo.git('add', 'src/app.ts')
    await f.write('src/app.ts', 'staged\nunstaged\n')
    await f.write('fresh.txt', 'new\n')
    f.repo.git('add', 'fresh.txt')
    f.repo.git('rm', '-q', '--cached', 'long.ts')
    const l = ok(await list('uncommitted', 'main', f))
    expect(l.files.map((x) => [x.path, x.status, x.staged ?? false])).toEqual([
      ['README.md', 'M', true],
      ['fresh.txt', 'A', true],
      ['long.ts', 'D', true],
      ['src/app.ts', 'M', true],
      ['assets/logo.png', 'M', false],
      ['long.ts', 'U', false],
      ['notes/todo.txt', 'U', false],
      ['src/app.ts', 'M', false],
    ])
    expect(l.totals.files).toBe(l.files.length)
  })

  it('a staged file in a repository without commits is an added staged entry', async () => {
    const f = buildEmptyFixture()
    extra.push(f)
    await f.write('first.txt', 'one\n')
    f.repo.git('add', 'first.txt')
    expect(ok(await list('uncommitted', 'main', f)).files).toEqual([
      { path: 'first.txt', status: 'A', additions: 1, deletions: 0, binary: false, staged: true },
    ])
  })

  it.each([
    ['main', STANDARD_EXPECT.branchVsMain, 2],
    ['develop', STANDARD_EXPECT.branchVsDevelop, 1],
  ])('branch mode lists merge-base..HEAD against %s', async (base, expected, commits) => {
    const l = ok(await list('branch', base))
    expect(paths(l)).toEqual(expected)
    expect(l.commitCount).toBe(commits)
    expect(l.mergeBase).toBe(fx.repo.git('merge-base', base, 'HEAD'))
  })

  it('branch mode against main has the expected statuses and rename', async () => {
    const l = await list('branch')
    expect(ok(l).files.map((f) => f.status)).toEqual(['A', 'M', 'R', 'D', 'M'])
    expect(byPath(l, 'new-name.txt')?.oldPath).toBe('old-name.txt')
  })

  it('lists paths with special characters', async () => {
    const f = await buildStandardFixture()
    extra.push(f)
    await f.write('dir with space/ünï "q".txt', 'x\n')
    await f.write('-dash.txt', 'y\n')
    expect(paths(await list('uncommitted', 'main', f))).toEqual(
      expect.arrayContaining(['dir with space/ünï "q".txt', '-dash.txt']),
    )
  })

  it('empty repo: uncommitted is ok with the untracked file, branch has no base', async () => {
    const f = buildEmptyFixture()
    extra.push(f)
    await f.write('first.txt', 'one\n')
    const u = ok(await list('uncommitted', 'main', f))
    expect(u.files.map((x) => [x.path, x.status])).toEqual([['first.txt', 'U']])
    expect(u.headSha).toBeNull()
    expect((await list('branch', 'main', f)).state).toBe('baseNotFound')
  })

  it.each([
    ['nope', 'baseNotFound'],
    ['orphan', 'noMergeBase'],
  ])('base %s → %s', async (base, state) => {
    if (base === 'orphan') {
      const emptyTree = fx.repo.git('hash-object', '-t', 'tree', '/dev/null')
      fx.repo.git('branch', '-f', 'orphan', fx.repo.git('commit-tree', emptyTree, '-m', 'unrelated'))
    }
    expect(await list('branch', base)).toEqual({ state, worktreeId: 'w', mode: 'branch', baseBranch: base })
  })

  it('totals sum additions/deletions', async () => {
    const l = ok(await list('branch'))
    const sum = (k: 'additions' | 'deletions') => l.files.reduce((n, f) => n + f[k], 0)
    expect(l.totals).toEqual({ files: l.files.length, additions: sum('additions'), deletions: sum('deletions') })
    expect(l.totals.additions).toBeGreaterThan(0)
  })
})
