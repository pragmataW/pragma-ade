import { afterEach, describe, expect, it } from 'vitest'
import { hunksOf, parseFilePatch, singleHunkPatch } from '../src/main/patch'
import { buildEmptyFixture, execGitPort, type StandardFixture } from '../testing'

const git = execGitPort()
const fixtures: StandardFixture[] = []
afterEach(() => {
  for (const f of fixtures.splice(0)) f.repo.cleanup()
})

const lines = (n: number, text: (i: number) => string, eol = '\n') =>
  Array.from({ length: n }, (_, i) => `${text(i + 1)}${eol}`).join('')
const DIFF_ARGS = ['diff', '--no-color', '--no-ext-diff', '--src-prefix=a/', '--dst-prefix=b/', '--unified=3']

async function repoWith(name: string, committed: string, working: string): Promise<StandardFixture> {
  const f = buildEmptyFixture()
  fixtures.push(f)
  f.repo.commit('base', { [name]: committed })
  await f.write(name, working)
  return f
}
/** a.txt with 30 lines; lines 2 and 28 edited on disk (two hunks). */
const twoHunkRepo = () =>
  repoWith(
    'a.txt',
    lines(30, (i) => `l${i}`),
    lines(30, (i) => (i === 2 || i === 28 ? `L${i}` : `l${i}`)),
  )
const diffOf = async (f: StandardFixture, path: string, cached = false) =>
  (await git.run(f.repo.path, [...DIFF_ARGS, ...(cached ? ['--cached'] : []), '--', path])).stdout
const apply = (f: StandardFixture, patch: string, ...flags: string[]) =>
  git.run(f.repo.path, ['apply', ...flags, '-'], { input: patch })
const indexText = async (f: StandardFixture, path: string) => (await git.show(f.repo.path, '', path)) ?? '<absent>'

describe('parseFilePatch', () => {
  it('splits the file header from the hunks and parses the ranges', async () => {
    const f = await twoHunkRepo()
    const diff = await diffOf(f, 'a.txt')
    const { head, hunks } = parseFilePatch(diff)
    expect(head[0]).toBe('diff --git a/a.txt b/a.txt')
    expect(head.at(-1)).toBe('+++ b/a.txt')
    expect(hunksOf(diff)).toEqual([
      { header: '@@ -1,5 +1,5 @@', oldStart: 1, oldLines: 5, newStart: 1, newLines: 5 },
      { header: '@@ -25,6 +25,6 @@', oldStart: 25, oldLines: 6, newStart: 25, newLines: 6 },
    ])
    expect(hunks[0]?.lines).toHaveLength(7)
  })

  it('a range without a count spans one line', () => {
    expect(hunksOf('diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -3 +3 @@\n-a\n+b\n')).toEqual([
      { header: '@@ -3 +3 @@', oldStart: 3, oldLines: 1, newStart: 3, newLines: 1 },
    ])
  })
})

describe('singleHunkPatch', () => {
  it('stages one of two hunks with git apply --cached', async () => {
    const f = await twoHunkRepo()
    const patch = singleHunkPatch(await diffOf(f, 'a.txt'), '@@ -1,5 +1,5 @@')
    await apply(f, patch ?? '', '--cached')
    expect(await indexText(f, 'a.txt')).toBe(lines(30, (i) => (i === 2 ? `L${i}` : `l${i}`)))
  })

  it('keeps CRLF line endings byte for byte', async () => {
    const committed = lines(20, (i) => `c${i}`, '\r\n')
    const f = await repoWith(
      'crlf.txt',
      committed,
      lines(20, (i) => (i === 1 || i === 20 ? `C${i}` : `c${i}`), '\r\n'),
    )
    const [first] = hunksOf(await diffOf(f, 'crlf.txt'))
    await apply(f, singleHunkPatch(await diffOf(f, 'crlf.txt'), first?.header ?? '') ?? '', '--cached')
    expect(await indexText(f, 'crlf.txt')).toBe(lines(20, (i) => (i === 1 ? `C${i}` : `c${i}`), '\r\n'))
  })

  it('handles a last line without a newline at the end of the file', async () => {
    const f = await repoWith('nonl.txt', 'a\nb\nc', 'a\nb\nC')
    const diff = await diffOf(f, 'nonl.txt')
    expect(diff).toContain('\\ No newline at end of file')
    const [hunk] = hunksOf(diff)
    await apply(f, singleHunkPatch(diff, hunk?.header ?? '') ?? '', '--cached')
    expect(await indexText(f, 'nonl.txt')).toBe('a\nb\nC')
  })

  it('discards a hunk from the worktree with git apply -R', async () => {
    const f = await twoHunkRepo()
    await apply(f, singleHunkPatch(await diffOf(f, 'a.txt'), '@@ -25,6 +25,6 @@') ?? '', '-R')
    expect(await diffOf(f, 'a.txt')).not.toContain('L28')
    expect(await diffOf(f, 'a.txt')).toContain('+L2')
  })

  it('unstages the only hunk of a staged new file (the file leaves the index, stays on disk)', async () => {
    const f = await repoWith('keep.txt', 'k\n', 'k\n')
    await f.write('new.txt', 'one\ntwo\n')
    f.repo.git('add', 'new.txt')
    const diff = await diffOf(f, 'new.txt', true)
    expect(diff).toContain('new file mode')
    const [hunk] = hunksOf(diff)
    await apply(f, singleHunkPatch(diff, hunk?.header ?? '') ?? '', '--cached', '-R')
    expect(f.repo.git('ls-files', 'new.txt')).toBe('')
    expect(f.repo.git('status', '--porcelain')).toContain('?? new.txt')
  })

  it('is null for a hunk the diff no longer has', () => {
    expect(singleHunkPatch('diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n-a\n+b\n', '@@ -9 +9 @@')).toBeNull()
    expect(singleHunkPatch('', '@@ -1 +1 @@')).toBeNull()
  })
})
