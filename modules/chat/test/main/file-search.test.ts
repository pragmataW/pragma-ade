import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createAgentsApiFrom } from '../../src/main/agents-adapter'
import { createFileSearch, rankPath } from '../../src/main/file-search'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function tempRepo(files: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'pragma-chat-files-'))
  dirs.push(dir)
  execFileSync('git', ['init', '-q'], { cwd: dir })
  for (const f of files) {
    mkdirSync(join(dir, dirname(f)), { recursive: true })
    writeFileSync(join(dir, f), 'x')
  }
  writeFileSync(join(dir, '.gitignore'), 'ignored/\n')
  return dir
}

const git = { run: async (cwd: string, args: string[]) => ({ stdout: execFileSync('git', args, { cwd }).toString() }) }
const api = createAgentsApiFrom({
  agents: {} as never,
  projects: { getWorktree: async () => null },
  git,
  log: { warn: () => undefined },
})

describe('file search', () => {
  it('searchFiles ranks basename prefix first', async () => {
    const repo = tempRepo([
      'src/app.ts',
      'docs/apple.md',
      'apps/notes.txt',
      'happy/zap.md',
      'ignored/app.ts',
      'lib/x.ts',
    ])
    const search = createFileSearch({ listFiles: (p) => api.listWorktreeFiles(p) })
    expect(await search.search(repo, 'app', 50)).toEqual([
      'src/app.ts',
      'docs/apple.md',
      'apps/notes.txt',
      'happy/zap.md',
    ])
    expect(await search.search(repo, 'APP', 1)).toEqual(['src/app.ts'])
  })

  it.each([
    ['src/app.ts', 'app', 0],
    ['apps/notes.txt', 'app', 1],
    ['happy/zap.md', 'hzp', 2],
    ['lib/x.ts', 'app', null],
  ])('rankPath(%s, %s) = %s', (path, query, rank) => expect(rankPath(path, query)).toBe(rank))

  it('caches the file list per worktree', async () => {
    let calls = 0
    const search = createFileSearch({
      listFiles: async () => {
        calls++
        return ['a.ts']
      },
    })
    await search.search('/w', 'a', 5)
    await search.search('/w', 'a', 5)
    expect(calls).toBe(1)
  })
})
