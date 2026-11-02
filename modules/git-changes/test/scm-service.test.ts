import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isolatedGitEnv } from '@pragma/test-support'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DestructiveSnapshot } from '../src/contract'
import { DestructiveHooks } from '../src/main/destructive-hooks'
import { ScmService } from '../src/main/scm-service'
import { buildEmptyFixture, execGitPort, type StandardFixture } from '../testing'

const fixtures: StandardFixture[] = []
const dirs: string[] = []
afterEach(() => {
  for (const f of fixtures.splice(0)) f.repo.cleanup()
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

const lines = (n: number, text: (i: number) => string) =>
  Array.from({ length: n }, (_, i) => `${text(i + 1)}\n`).join('')
const quiet = { warn: vi.fn() }

function setup(files: Record<string, string> = { 'a.txt': 'a\n', 'b.txt': 'b\n' }) {
  const f = buildEmptyFixture()
  fixtures.push(f)
  f.repo.commit('initial', files)
  const hooks = new DestructiveHooks(quiet)
  const seen: { snapshot: DestructiveSnapshot; contents: Record<string, string | null> }[] = []
  hooks.onBeforeDestructive((snapshot) => {
    const read = (p: string) => (existsSync(join(snapshot.cwd, p)) ? readFileSync(join(snapshot.cwd, p), 'utf8') : null)
    seen.push({ snapshot, contents: Object.fromEntries(snapshot.paths.map((p) => [p, read(p)])) })
  })
  const changed = vi.fn()
  const scm = new ScmService({ git: execGitPort(), hooks, pullRebase: () => false, onChanged: changed })
  const t = { worktreeId: 'w', cwd: f.repo.path }
  const read = (p: string) => (existsSync(join(f.repo.path, p)) ? readFileSync(join(f.repo.path, p), 'utf8') : null)
  /** Untrimmed `status --porcelain` lines, sorted (the fixture's `git()` trims the leading space of ` M`). */
  const porcelain = () =>
    execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: f.repo.path,
      env: isolatedGitEnv(),
      encoding: 'utf8',
    })
      .split('\n')
      .filter((l) => l !== '')
      .sort()
  return { f, scm, t, seen, changed, read, porcelain }
}

const OK = { ok: true }

describe('ScmService stage / unstage', () => {
  it('stages and unstages single files and everything, emitting changed after each operation', async () => {
    const { f, scm, t, changed, porcelain } = setup()
    await f.write('a.txt', 'A\n')
    await f.write('b.txt', 'B\n')
    await f.write('new.txt', 'n\n')
    expect(await scm.stage(t, ['a.txt'])).toEqual(OK)
    expect(porcelain()).toEqual([' M b.txt', '?? new.txt', 'M  a.txt'])
    expect(await scm.stage(t)).toEqual(OK)
    expect(porcelain()).toEqual(['A  new.txt', 'M  a.txt', 'M  b.txt'])
    expect(await scm.unstage(t, ['b.txt'])).toEqual(OK)
    expect(porcelain()).toEqual([' M b.txt', 'A  new.txt', 'M  a.txt'])
    expect(await scm.unstage(t)).toEqual(OK)
    expect(porcelain()).toEqual([' M a.txt', ' M b.txt', '?? new.txt'])
    expect(changed).toHaveBeenCalledTimes(4)
    expect(changed).toHaveBeenCalledWith('w')
  })

  it('treats paths literally (a pathspec-looking name only matches itself)', async () => {
    const { f, scm, t, porcelain } = setup()
    await f.write('a.txt', 'A\n')
    await f.write('*.txt', 'star\n')
    expect(await scm.stage(t, ['*.txt'])).toEqual(OK)
    expect(porcelain()).toEqual([' M a.txt', 'A  *.txt'])
  })

  it('unstages in a repository without commits', async () => {
    const f = buildEmptyFixture()
    fixtures.push(f)
    const scm = new ScmService({
      git: execGitPort(),
      hooks: new DestructiveHooks(quiet),
      pullRebase: () => false,
      onChanged: () => undefined,
    })
    await f.write('first.txt', '1\n')
    f.repo.git('add', 'first.txt')
    expect(await scm.unstage({ worktreeId: 'w', cwd: f.repo.path })).toEqual(OK)
    expect(f.repo.git('status', '--porcelain')).toBe('?? first.txt')
  })
})

describe('ScmService discard', () => {
  it('restores a tracked file and deletes an untracked one, snapshotting their contents first', async () => {
    const { f, scm, t, seen, read } = setup()
    await f.write('a.txt', 'edited\n')
    await f.write('junk.txt', 'junk\n')
    expect(await scm.discard(t, ['a.txt'])).toEqual(OK)
    expect(read('a.txt')).toBe('a\n')
    expect(await scm.discard(t, ['junk.txt'])).toEqual(OK)
    expect(read('junk.txt')).toBeNull()
    expect(seen.map((s) => [s.snapshot.reason, s.contents])).toEqual([
      ['discard', { 'a.txt': 'edited\n' }],
      ['cleanUntracked', { 'junk.txt': 'junk\n' }],
    ])
  })

  it('discard all reverts every unstaged change, keeps the staged ones', async () => {
    const { f, scm, t, seen, read, porcelain } = setup()
    await f.write('a.txt', 'staged\n')
    f.repo.git('add', 'a.txt')
    await f.write('a.txt', 'staged\nmore\n')
    await f.rm('b.txt')
    await f.write('dir/junk.txt', 'junk\n')
    expect(await scm.discard(t)).toEqual(OK)
    expect(read('a.txt')).toBe('staged\n')
    expect(read('b.txt')).toBe('b\n')
    expect(porcelain()).toEqual(['M  a.txt'])
    expect(seen[0]?.snapshot).toMatchObject({ reason: 'discardAll', worktreeId: 'w', headSha: null, stashes: [] })
    expect(seen[0]?.snapshot.paths.sort()).toEqual(['a.txt', 'b.txt', 'dir/junk.txt'])
  })

  it('a failing hook is logged and does not block the discard', async () => {
    const { f, t, read } = setup()
    const hooks = new DestructiveHooks(quiet)
    hooks.onBeforeDestructive(() => {
      throw new Error('boom')
    })
    const s = new ScmService({ git: execGitPort(), hooks, pullRebase: () => false, onChanged: () => undefined })
    await f.write('a.txt', 'edited\n')
    expect(await s.discard(t, ['a.txt'])).toEqual(OK)
    expect(read('a.txt')).toBe('a\n')
    expect(quiet.warn).toHaveBeenCalled()
  })
})

describe('ScmService hunks', () => {
  const thirty = lines(30, (i) => `l${i}`)
  const edited = lines(30, (i) => (i === 2 || i === 28 ? `L${i}` : `l${i}`))

  it('lists, stages, unstages and discards single hunks', async () => {
    const { f, scm, t, seen, read } = setup({ 'a.txt': thirty })
    await f.write('a.txt', edited)
    const hunks = await scm.hunks(t.cwd, 'a.txt', false)
    expect(hunks.map((h) => h.header)).toEqual(['@@ -1,5 +1,5 @@', '@@ -25,6 +25,6 @@'])
    expect(
      await scm.applyHunk(t, { worktreeId: 'w', path: 'a.txt', action: 'stage', header: '@@ -1,5 +1,5 @@' }),
    ).toEqual(OK)
    expect(f.repo.git('diff', '--cached')).toContain('+L2')
    const staged = await scm.hunks(t.cwd, 'a.txt', true)
    expect(staged).toHaveLength(1)
    const unstage = { worktreeId: 'w', path: 'a.txt', action: 'unstage', header: staged[0]?.header ?? '' } as const
    expect(await scm.applyHunk(t, unstage)).toEqual(OK)
    expect(f.repo.git('diff', '--cached')).toBe('')
    const discard = { worktreeId: 'w', path: 'a.txt', action: 'discard', header: '@@ -25,6 +25,6 @@' } as const
    expect(await scm.applyHunk(t, discard)).toEqual(OK)
    expect(read('a.txt')).toBe(lines(30, (i) => (i === 2 ? `L${i}` : `l${i}`)))
    expect(seen.map((s) => [s.snapshot.reason, s.contents])).toEqual([['discardHunk', { 'a.txt': edited }]])
  })

  it('a hunk that changed since it was listed is stale', async () => {
    const { f, scm, t } = setup({ 'a.txt': thirty })
    await f.write('a.txt', edited)
    const r = await scm.applyHunk(t, { worktreeId: 'w', path: 'a.txt', action: 'stage', header: '@@ -9,9 +9,9 @@' })
    expect(r).toMatchObject({ ok: false, code: 'hunkStale' })
  })
})

describe('ScmService commit', () => {
  it('commits the staged changes with a multi-line message; empty and nothing staged fail', async () => {
    const { f, scm, t } = setup()
    const commit = { worktreeId: 'w', amend: false, signoff: false, stageAll: false }
    expect(await scm.commit(t, { ...commit, message: '  ' })).toMatchObject({ ok: false, code: 'emptyMessage' })
    expect(await scm.commit(t, { ...commit, message: 'nothing' })).toMatchObject({ ok: false, code: 'nothingToCommit' })
    await f.write('a.txt', 'A\n')
    f.repo.git('add', 'a.txt')
    expect(await scm.commit(t, { ...commit, message: 'Subject\n\nBody line' })).toEqual(OK)
    expect(f.repo.git('log', '-1', '--format=%B')).toBe('Subject\n\nBody line')
  })

  it('smart commit stages everything; amend keeps the message when empty; sign-off adds the trailer', async () => {
    const { f, scm, t, porcelain } = setup()
    await f.write('a.txt', 'A\n')
    await f.write('new.txt', 'n\n')
    const base = { worktreeId: 'w', amend: false, signoff: false, stageAll: true }
    expect(await scm.commit(t, { ...base, message: 'all' })).toEqual(OK)
    expect(porcelain()).toEqual([])
    await f.write('b.txt', 'B\n')
    expect(await scm.commit(t, { ...base, message: '', amend: true, signoff: true })).toEqual(OK)
    expect(f.repo.git('log', '-1', '--format=%B')).toMatch(/^all\n\nSigned-off-by: Pragma Test/)
    expect(f.repo.git('rev-list', '--count', 'HEAD')).toBe('2')
  })

  it('undo last commit keeps its changes staged; undoing the first commit leaves no HEAD', async () => {
    const { f, scm, t, seen, porcelain } = setup()
    const first = f.repo.git('rev-parse', 'HEAD')
    const second = f.repo.commit('second', { 'a.txt': 'second\n' })
    expect(await scm.undoCommit(t)).toEqual(OK)
    expect(f.repo.git('rev-parse', 'HEAD')).toBe(first)
    expect(porcelain()).toEqual(['M  a.txt'])
    expect(seen[0]?.snapshot).toMatchObject({ reason: 'undoCommit', headSha: second, paths: [] })
    expect(await scm.undoCommit(t)).toEqual(OK)
    expect((await scm.state(t.cwd)).hasHead).toBe(false)
  })
})

describe('ScmService stash', () => {
  it('pushes with a message, lists, applies, pops and drops by sha', async () => {
    const { f, scm, t, seen, read } = setup()
    const push = { worktreeId: 'w', includeUntracked: false, staged: false }
    expect(await scm.stashPush(t, { ...push, message: 'none' })).toMatchObject({ ok: false, code: 'nothingToStash' })
    await f.write('a.txt', 'one\n')
    expect(await scm.stashPush(t, { ...push, message: 'first' })).toEqual(OK)
    await f.write('b.txt', 'two\n')
    await f.write('u.txt', 'untracked\n')
    expect(await scm.stashPush(t, { ...push, message: '', includeUntracked: true })).toEqual(OK)
    expect(read('u.txt')).toBeNull()
    const stashes = await scm.stashes(t.cwd)
    expect(stashes.map((s) => [s.index, s.message])).toEqual([
      [0, expect.stringMatching(/^WIP on main/)],
      [1, 'On main: first'],
    ])
    const [latest, oldest] = stashes
    expect(await scm.stash(t, { action: 'apply', sha: oldest?.sha ?? '' })).toEqual(OK)
    expect(read('a.txt')).toBe('one\n')
    f.repo.git('checkout', '--', 'a.txt')
    expect(await scm.stash(t, { action: 'pop', sha: latest?.sha ?? '' })).toEqual(OK)
    expect(read('u.txt')).toBe('untracked\n')
    expect(await scm.stash(t, { action: 'drop', sha: oldest?.sha ?? '' })).toEqual(OK)
    expect(await scm.stashes(t.cwd)).toEqual([])
    expect(seen.map((s) => [s.snapshot.reason, s.snapshot.stashes.map((x) => x.sha)])).toEqual([
      ['stashDrop', [oldest?.sha]],
    ])
    expect(await scm.stash(t, { action: 'drop', sha: oldest?.sha ?? '' })).toMatchObject({ code: 'stashNotFound' })
  })

  it('stashes only the staged changes; clear drops every stash after the hook', async () => {
    const { f, scm, t, seen, porcelain } = setup()
    await f.write('a.txt', 'staged\n')
    f.repo.git('add', 'a.txt')
    await f.write('b.txt', 'unstaged\n')
    expect(await scm.stashPush(t, { worktreeId: 'w', message: 's', includeUntracked: false, staged: true })).toEqual(OK)
    expect(porcelain()).toEqual([' M b.txt'])
    expect(await scm.stashClear(t)).toEqual(OK)
    expect(await scm.stashes(t.cwd)).toEqual([])
    expect(seen[0]?.snapshot).toMatchObject({ reason: 'stashClear' })
    expect(seen[0]?.snapshot.stashes).toHaveLength(1)
  })
})

describe('ScmService remote', () => {
  function bareRemote(): string {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'pragma-gc-remote-')))
    dirs.push(dir)
    execFileSync('git', ['init', '-q', '--bare', '-b', 'main', join(dir, 'remote.git')], { env: isolatedGitEnv() })
    return `file://${join(dir, 'remote.git')}`
  }

  /** Another clone of `url` pushes one commit (the remote moves ahead of us). */
  function pushFromAnotherClone(url: string): void {
    const other = join(dirs[0] ?? '', 'other')
    const env = isolatedGitEnv()
    execFileSync('git', ['clone', '-q', url, other], { env })
    execFileSync('git', ['-C', other, 'commit', '-q', '--allow-empty', '-m', 'remote'], { env })
    execFileSync('git', ['-C', other, 'push', '-q'], { env })
  }

  it('push publishes a branch without upstream; ahead/behind follow; pull and sync bring remote commits', async () => {
    const { f, scm, t, read } = setup()
    const url = bareRemote()
    expect(await scm.remote(t, 'push')).toMatchObject({ ok: false, code: 'noRemote' })
    f.repo.git('remote', 'add', 'origin', url)
    expect(await scm.state(t.cwd)).toMatchObject({ branch: 'main', upstream: null, ahead: 0, behind: 0, hasHead: true })
    expect(await scm.remote(t, 'push')).toEqual(OK)
    expect(await scm.state(t.cwd)).toMatchObject({ upstream: 'origin/main', ahead: 0 })
    f.repo.commit('local', { 'a.txt': 'local\n' })
    expect((await scm.state(t.cwd)).ahead).toBe(1)
    expect(await scm.remote(t, 'sync')).toEqual(OK)
    expect((await scm.state(t.cwd)).ahead).toBe(0)

    pushFromAnotherClone(url)
    expect(await scm.remote(t, 'fetch')).toEqual(OK)
    expect((await scm.state(t.cwd)).behind).toBe(1)
    expect(await scm.remote(t, 'pull')).toEqual(OK)
    expect((await scm.state(t.cwd)).behind).toBe(0)
    expect(read('a.txt')).toBe('local\n')
  })

  it('a rejected push is non-fast-forward', async () => {
    const { f, scm, t } = setup()
    const url = bareRemote()
    f.repo.git('remote', 'add', 'origin', url)
    expect(await scm.remote(t, 'push')).toEqual(OK)
    pushFromAnotherClone(url)
    f.repo.commit('local', { 'a.txt': 'local\n' })
    expect(await scm.remote(t, 'push')).toMatchObject({ ok: false, code: 'nonFastForward' })
  })
})

describe('ScmService queue', () => {
  it('runs one repository’s operations one at a time', async () => {
    const { f, scm, t } = setup()
    await f.write('a.txt', 'A\n')
    await f.write('b.txt', 'B\n')
    const base = { worktreeId: 'w', amend: false, signoff: false, stageAll: false }
    const results = await Promise.all([
      scm.stage(t, ['a.txt']),
      scm.commit(t, { ...base, message: 'one' }),
      scm.stage(t, ['b.txt']),
      scm.commit(t, { ...base, message: 'two' }),
    ])
    expect(results).toEqual([OK, OK, OK, OK])
    expect(f.repo.git('log', '--format=%s', '-2')).toBe('two\none')
  })
})
