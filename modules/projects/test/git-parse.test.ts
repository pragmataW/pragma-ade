import { afterEach, describe, expect, it } from 'vitest'
import { parseBranchList, parseStatusV2, parseWorktreeList } from '../src/main/git/parse'
import { type FixtureRepo, makeRepo } from './support/git-fixture'

describe('git porcelain parsers', () => {
  it('parseStatusV2 reads branch headers and all entry kinds', () => {
    const out =
      '# branch.oid abc123\0# branch.head feat/x\0# branch.upstream origin/feat/x\0# branch.ab +2 -1\0' +
      '1 .M N... 100644 100644 100644 aaa bbb src/a.ts\0' +
      '2 R. N... 100644 100644 100644 aaa bbb R100 new name.ts\0old name.ts\0' +
      'u UU N... 100644 100644 100644 100644 aaa bbb ccc conflict.ts\0' +
      '? untracked dir/file.txt\0' +
      '! ignored.log\0'
    const s = parseStatusV2(out)
    expect(s).toMatchObject({ branch: 'feat/x', oid: 'abc123', upstream: 'origin/feat/x', ahead: 2, behind: 1 })
    expect(s.entries).toEqual([
      { kind: 'ordinary', path: 'src/a.ts', index: '.', worktree: 'M' },
      { kind: 'renamed', path: 'new name.ts', origPath: 'old name.ts', index: 'R', worktree: '.' },
      { kind: 'unmerged', path: 'conflict.ts', index: 'U', worktree: 'U' },
      { kind: 'untracked', path: 'untracked dir/file.txt', index: '?', worktree: '?' },
    ])
  })

  it('parseStatusV2 maps detached head and initial commit', () => {
    expect(parseStatusV2('# branch.oid (initial)\0# branch.head (detached)\0')).toMatchObject({
      branch: null,
      oid: null,
      upstream: null,
      ahead: null,
      behind: null,
      entries: [],
    })
  })

  it('parseWorktreeList reads main, linked, detached, locked, prunable', () => {
    const out =
      'worktree /r\0HEAD 111\0branch refs/heads/main\0\0' +
      'worktree /w/feat\0HEAD 222\0branch refs/heads/feat/x\0locked\0\0' +
      'worktree /w/det\0HEAD 333\0detached\0prunable gitdir file points to non-existent location\0\0'
    expect(parseWorktreeList(out)).toEqual([
      { path: '/r', head: '111', branch: 'main', bare: false, detached: false, locked: false, prunable: false },
      { path: '/w/feat', head: '222', branch: 'feat/x', bare: false, detached: false, locked: true, prunable: false },
      { path: '/w/det', head: '333', branch: null, bare: false, detached: true, locked: false, prunable: true },
    ])
  })

  it('parseWorktreeList reads a bare main entry', () => {
    expect(parseWorktreeList('worktree /b.git\0bare\0\0')).toEqual([
      { path: '/b.git', head: null, branch: null, bare: true, detached: false, locked: false, prunable: false },
    ])
  })

  it('parseBranchList separates local and remote and skips remote HEAD', () => {
    const out =
      'refs/heads/main\0/r\0\nrefs/heads/feat/x\0\0\nrefs/remotes/origin/HEAD\0\0\nrefs/remotes/origin/dev\0\0\n'
    expect(parseBranchList(out)).toEqual([
      { name: 'main', kind: 'local', checkedOutAt: '/r' },
      { name: 'feat/x', kind: 'local', checkedOutAt: null },
      { name: 'origin/dev', kind: 'remote', checkedOutAt: null },
    ])
  })
})

describe('git fixture', () => {
  let repo: FixtureRepo | undefined
  afterEach(() => repo?.cleanup())

  it('makeRepo is on main with exactly one commit', async () => {
    repo = await makeRepo()
    expect(await repo.git('symbolic-ref', '--short', 'HEAD')).toBe('main')
    expect(await repo.git('rev-list', '--count', 'HEAD')).toBe('1')
  })
})
