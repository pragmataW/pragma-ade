import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ChangeMode, FileStatus, FileVersion } from '../src/contract'
import { DiffService } from '../src/main/diff-service'
import { InvalidPathError } from '../src/main/read-side'
import { buildEmptyFixture, buildStandardFixture, execGitPort, type StandardFixture } from '../testing'

const MAX = 1_048_576
const BIG_BYTES = 1_258_291
const git = execGitPort()
const service = new DiffService({ git, maxFileBytes: () => MAX })
let fx: StandardFixture
let small: StandardFixture

type Req = { mode: ChangeMode; path: string; status: FileStatus; oldPath?: string; staged?: boolean }
const get = (r: Req, f: StandardFixture = fx) => service.getFileContents({ cwd: f.repo.path, baseBranch: 'main', ...r })
const textOf = (v: FileVersion): string => (v.kind === 'text' ? v.contents : `<${v.kind}>`)

beforeAll(async () => {
  fx = await buildStandardFixture()
  small = buildEmptyFixture()
  small.repo.commit('bytes', { 'crlf.txt': 'a\r\nb\r\n', 'nonl.txt': 'x', 'dir with space/ünï "q".txt': 'q1\n' })
  await small.write('crlf.txt', 'a\r\nB\r\n')
  await small.write('nonl.txt', 'y')
  await small.write('dir with space/ünï "q".txt', 'q2\n')
})
afterAll(() => {
  fx.repo.cleanup()
  small.repo.cleanup()
})

describe('DiffService.getFileContents', () => {
  it.each([
    ['modified', 'uncommitted', 'src/app.ts', 'M', undefined, 'text', 'text'],
    ['renamed', 'branch', 'new-name.txt', 'R', 'old-name.txt', 'text', 'text'],
    ['added', 'branch', 'docs/added.md', 'A', undefined, 'absent', 'text'],
    ['deleted', 'branch', 'remove-me.txt', 'D', undefined, 'text', 'absent'],
    ['untracked', 'uncommitted', 'notes/todo.txt', 'U', undefined, 'absent', 'text'],
    ['binary', 'uncommitted', 'assets/logo.png', 'M', undefined, 'binary', 'binary'],
  ] as const)('%s file: old %s/%s → %s, %s', async (_n, mode, path, status, oldPath, oldKind, newKind) => {
    const c = await get({ mode, path, status, oldPath })
    expect([c.old.kind, c.new.kind]).toEqual([oldKind, newKind])
    expect(c).toMatchObject({ path, status, ...(oldPath ? { oldPath } : {}) })
  })

  it('the modified old side is the committed text, untrimmed', async () => {
    const c = await get({ mode: 'uncommitted', path: 'src/app.ts', status: 'M' })
    expect(textOf(c.old)).toBe(await git.show(fx.repo.path, 'HEAD', 'src/app.ts'))
    expect(textOf(c.new)).toContain('app 10 edited\n')
  })

  it('the renamed old side reads the old path at the merge-base', async () => {
    const c = await get({ mode: 'branch', path: 'new-name.txt', status: 'R', oldPath: 'old-name.txt' })
    expect(textOf(c.old)).toBe(await git.show(fx.repo.path, 'main', 'old-name.txt'))
  })

  it('tooLarge above maxFileBytes', async () => {
    await fx.write('big.txt', 'x'.repeat(BIG_BYTES))
    const c = await get({ mode: 'uncommitted', path: 'big.txt', status: 'U' })
    expect(c.new).toEqual({ kind: 'tooLarge', bytes: BIG_BYTES })
    await fx.rm('big.txt')
  })

  it('ENOENT yields absent', async () => {
    await fx.write('vanishing.txt', 'soon gone\n')
    const listed = await service.listChanges({
      worktreeId: 'w',
      cwd: fx.repo.path,
      mode: 'uncommitted',
      baseBranch: 'main',
    })
    expect(listed.state === 'ok' && listed.files.some((f) => f.path === 'vanishing.txt')).toBe(true)
    await fx.rm('vanishing.txt')
    const c = await get({ mode: 'uncommitted', path: 'vanishing.txt', status: 'U' })
    expect(c.new).toEqual({ kind: 'absent' })
  })

  it.each([
    ['crlf.txt', 'a\r\nb\r\n', 'a\r\nB\r\n'],
    ['nonl.txt', 'x', 'y'],
  ])('preserves trailing newline and CRLF (%s)', async (path, committed, edited) => {
    const c = await get({ mode: 'uncommitted', path, status: 'M' }, small)
    expect([textOf(c.old), textOf(c.new)]).toEqual([committed, edited])
  })

  it('reads contents of special-char path', async () => {
    const c = await get({ mode: 'uncommitted', path: 'dir with space/ünï "q".txt', status: 'M' }, small)
    expect([textOf(c.old), textOf(c.new)]).toEqual(['q1\n', 'q2\n'])
  })

  it('rejects traversal', async () => {
    await expect(get({ mode: 'uncommitted', path: '../outside', status: 'M' })).rejects.toBeInstanceOf(InvalidPathError)
  })

  it('a staged entry diffs HEAD against the index; an unstaged one the index against the disk', async () => {
    const f = await buildStandardFixture()
    await f.write('src/app.ts', 'index\n')
    f.repo.git('add', 'src/app.ts')
    await f.write('src/app.ts', 'disk\n')
    const staged = await get({ mode: 'uncommitted', path: 'src/app.ts', status: 'M', staged: true }, f)
    const unstaged = await get({ mode: 'uncommitted', path: 'src/app.ts', status: 'M' }, f)
    f.repo.cleanup()
    expect(textOf(staged.old)).toMatch(/^app 1\n/)
    expect(textOf(staged.new)).toBe('index\n')
    expect(textOf(unstaged.old)).toBe('index\n')
    expect(textOf(unstaged.new)).toBe('disk\n')
  })

  it.each([
    ['staged added', { path: 'fresh.txt', status: 'A', staged: true }, ['absent', 'fresh\n']],
    ['staged deleted', { path: 'long.ts', status: 'D', staged: true }, ['line 1 unchanged', 'absent']],
    ['unstaged deleted', { path: 'remove-me.txt', status: 'D' }, ['this file gets removed\n', 'absent']],
  ] as const)('%s file reads the right sides', async (_n, req, [oldText, newText]) => {
    const f = await buildStandardFixture()
    f.repo.git('checkout', '-q', 'main')
    await f.write('fresh.txt', 'fresh\n')
    f.repo.git('add', 'fresh.txt')
    f.repo.git('rm', '-q', '--cached', 'long.ts')
    await f.rm('remove-me.txt')
    const c = await get({ mode: 'uncommitted', ...req }, f)
    f.repo.cleanup()
    const [o, n] = [textOf(c.old), textOf(c.new)]
    expect(oldText === 'absent' ? c.old.kind : o.slice(0, oldText.length)).toBe(oldText)
    expect(newText === 'absent' ? c.new.kind : n).toBe(newText)
  })

  it('branch mode without a base reads the old side as absent', async () => {
    const c = await service.getFileContents({
      cwd: fx.repo.path,
      baseBranch: 'nope',
      mode: 'branch',
      path: 'long.ts',
      status: 'M',
    })
    expect([c.old.kind, c.new.kind]).toEqual(['absent', 'text'])
  })
})
