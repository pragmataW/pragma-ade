import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { applyMigrations, openDatabase } from '@pragma/sdk/runtime/main'
import { createFixtureRepo, createTempUserData, isolatedGitEnv, loadModuleRecord } from '@pragma/test-support'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DAY_MS, MAX_SAVED_FILE_BYTES, MB } from '../src/constants'
import { type LocalHistoryService, type LocalHistorySettings, LocalHistorySettingsSchema } from '../src/contract'
import { createBlobStore } from '../src/main/blobs'
import { toRecordInput } from '../src/main/index'
import { createHistoryStore } from '../src/main/store'

const MODULE_DIR = join(import.meta.dirname, '..')
const cleanups: (() => void)[] = []
afterEach(() => {
  vi.useRealTimers()
  for (const c of cleanups.splice(0)) c()
})

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd, env: isolatedGitEnv(), encoding: 'utf8' }).trim()
const gitPort = {
  run: async (cwd: string, args: string[]) => {
    try {
      return { stdout: git(cwd, ...args), stderr: '', exitCode: 0 }
    } catch (e) {
      return { stdout: '', stderr: String((e as { stderr?: string }).stderr ?? e), exitCode: 1 }
    }
  },
}

async function setup(opts: { settings?: Partial<LocalHistorySettings>; files?: Record<string, string> } = {}) {
  const dir = createTempUserData()
  const record = await loadModuleRecord(MODULE_DIR)
  const opened = openDatabase(join(dir.path, 'local-history.db'))
  const applied = applyMigrations(opened.sqlite, [{ module: record.manifest.id, migrations: record.migrations }])
  if (applied.failed) throw applied.failed.error
  const repo = createFixtureRepo({ files: opts.files ?? { 'a.txt': 'one\n', 'src/b.ts': 'export const b = 1\n' } })
  const blobDir = join(dir.path, 'blobs')
  const changed = vi.fn()
  const store: LocalHistoryService = createHistoryStore({
    db: opened.db,
    blobs: createBlobStore(blobDir),
    settings: () => LocalHistorySettingsSchema.parse(opts.settings ?? {}),
    git: () => gitPort,
    onChanged: changed,
  })
  cleanups.push(() => {
    opened.close()
    dir.cleanup()
    repo.cleanup()
  })
  return { store, cwd: repo.path, blobDir, changed }
}

const discard = (cwd: string, paths: string[]) => ({
  worktreeId: 'wt',
  cwd,
  reason: 'discard' as const,
  paths,
  stashes: [],
  headSha: null,
})

describe('local history store', () => {
  it('saves files before a discard and restores them', async () => {
    const { store, cwd, changed } = await setup()
    writeFileSync(join(cwd, 'a.txt'), 'edited by me\n')
    const entry = await store.record(discard(cwd, ['a.txt']))
    git(cwd, 'checkout', '--', 'a.txt')
    expect(readFileSync(join(cwd, 'a.txt'), 'utf8')).toBe('one\n')
    expect(entry).toMatchObject({ reason: 'discard', fileCount: 1, restoredAt: null })
    expect(store.fileContent(entry?.id as number, 'a.txt')).toEqual({ state: 'saved', saved: 'edited by me\n' })
    const result = await store.restore(entry?.id as number)
    expect(result).toEqual({ ok: true, restored: ['a.txt'], skipped: [] })
    expect(readFileSync(join(cwd, 'a.txt'), 'utf8')).toBe('edited by me\n')
    expect(changed).toHaveBeenCalled()
  })

  it('a restore is itself recorded, so it can be undone', async () => {
    const { store, cwd } = await setup()
    writeFileSync(join(cwd, 'a.txt'), 'mine\n')
    const first = await store.record(discard(cwd, ['a.txt']))
    writeFileSync(join(cwd, 'a.txt'), 'newer\n')
    await store.restore(first?.id as number)
    const [latest] = store.list()
    expect(latest?.reason).toBe('restore')
    await store.restore(latest?.id as number)
    expect(readFileSync(join(cwd, 'a.txt'), 'utf8')).toBe('newer\n')
  })

  it('restores deleted untracked files and removes files that did not exist', async () => {
    const { store, cwd } = await setup()
    writeFileSync(join(cwd, 'scratch.txt'), 'untracked work\n')
    const entry = await store.record({ ...discard(cwd, ['scratch.txt', 'never.txt']), reason: 'cleanUntracked' })
    git(cwd, 'clean', '-f')
    expect(existsSync(join(cwd, 'scratch.txt'))).toBe(false)
    writeFileSync(join(cwd, 'never.txt'), 'appeared later\n')
    expect(await store.restore(entry?.id as number)).toEqual({
      ok: true,
      restored: ['never.txt', 'scratch.txt'],
      skipped: [],
    })
    expect(readFileSync(join(cwd, 'scratch.txt'), 'utf8')).toBe('untracked work\n')
    expect(existsSync(join(cwd, 'never.txt'))).toBe(false)
  })

  it('restores one file of an entry on its own', async () => {
    const { store, cwd } = await setup()
    writeFileSync(join(cwd, 'a.txt'), 'A\n')
    writeFileSync(join(cwd, 'src/b.ts'), 'B\n')
    const entry = await store.record(discard(cwd, ['a.txt', 'src/b.ts']))
    git(cwd, 'checkout', '--', '.')
    await store.restore(entry?.id as number, ['src/b.ts'])
    expect(readFileSync(join(cwd, 'src/b.ts'), 'utf8')).toBe('B\n')
    expect(readFileSync(join(cwd, 'a.txt'), 'utf8')).toBe('one\n')
  })

  it('lists binary and too-large files without keeping them', async () => {
    const { store, cwd } = await setup()
    writeFileSync(join(cwd, 'bin.dat'), Buffer.from([1, 0, 2, 3]))
    writeFileSync(join(cwd, 'big.txt'), 'x'.repeat(MAX_SAVED_FILE_BYTES + 1))
    const entry = await store.record(discard(cwd, ['bin.dat', 'big.txt']))
    expect(store.detail(entry?.id as number)?.files.map((f) => [f.path, f.state])).toEqual([
      ['big.txt', 'tooLarge'],
      ['bin.dat', 'binary'],
    ])
    expect(await store.restore(entry?.id as number)).toEqual({
      ok: true,
      restored: [],
      skipped: ['big.txt', 'bin.dat'],
    })
  })

  it('never writes outside the worktree', async () => {
    const { store, cwd } = await setup()
    const entry = await store.record(discard(cwd, ['../outside.txt', 'a.txt']))
    expect(store.detail(entry?.id as number)?.files.map((f) => f.path)).toEqual(['a.txt'])
  })

  it('keeps identical content once', async () => {
    const { store, cwd, blobDir } = await setup()
    writeFileSync(join(cwd, 'a.txt'), 'same\n')
    writeFileSync(join(cwd, 'src/b.ts'), 'same\n')
    await store.record(discard(cwd, ['a.txt', 'src/b.ts']))
    await store.record(discard(cwd, ['a.txt']))
    expect(readdirSync(blobDir)).toHaveLength(1)
  })

  it('puts a dropped stash back', async () => {
    const { store, cwd } = await setup()
    writeFileSync(join(cwd, 'a.txt'), 'stashed\n')
    git(cwd, 'stash', 'push', '-m', 'wip')
    const sha = git(cwd, 'rev-parse', 'stash@{0}')
    const entry = await store.record({ ...discard(cwd, []), reason: 'stashDrop', stashes: [{ sha, message: 'wip' }] })
    git(cwd, 'stash', 'drop')
    expect(git(cwd, 'stash', 'list')).toBe('')
    expect(await store.restore(entry?.id as number)).toMatchObject({ ok: true })
    expect(git(cwd, 'stash', 'list')).toContain('wip')
    expect(git(cwd, 'rev-parse', 'stash@{0}')).toBe(sha)
  })

  it('redoes an undone commit only while HEAD has not moved', async () => {
    const { store, cwd } = await setup()
    writeFileSync(join(cwd, 'a.txt'), 'committed\n')
    git(cwd, 'commit', '-am', 'second')
    const sha = git(cwd, 'rev-parse', 'HEAD')
    const entry = await store.record({ ...discard(cwd, []), reason: 'undoCommit', headSha: sha })
    git(cwd, 'reset', '--soft', 'HEAD~1')
    expect(await store.restore(entry?.id as number)).toMatchObject({ ok: true })
    expect(git(cwd, 'rev-parse', 'HEAD')).toBe(sha)
    git(cwd, 'reset', '--soft', 'HEAD~1')
    git(cwd, 'commit', '-m', 'something else')
    expect(await store.restore(entry?.id as number)).toMatchObject({ ok: false, reason: 'headMoved' })
  })

  it('expires entries after retentionDays', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { store, cwd, blobDir } = await setup({ settings: { retentionDays: 2 } })
    vi.setSystemTime(new Date('2026-11-01T10:00:00Z'))
    await store.record(discard(cwd, ['a.txt']))
    vi.setSystemTime(new Date('2026-11-01T10:00:00Z').getTime() + DAY_MS)
    writeFileSync(join(cwd, 'src/b.ts'), 'kept\n')
    await store.record(discard(cwd, ['src/b.ts']))
    vi.setSystemTime(new Date('2026-11-01T10:00:00Z').getTime() + 2 * DAY_MS + 1)
    expect(store.prune()).toBe(1)
    expect(store.list().map((e) => e.fileCount)).toEqual([1])
    expect(readdirSync(blobDir)).toHaveLength(1)
  })

  it('drops the oldest entries past the size cap', async () => {
    const { store, cwd } = await setup({ settings: { maxTotalMb: 16 } })
    const chunk = 'y'.repeat(4 * MB)
    for (const n of [1, 2, 3, 4, 5]) {
      writeFileSync(join(cwd, 'a.txt'), `${n}${chunk}`)
      await store.record(discard(cwd, ['a.txt']))
    }
    expect(store.list()).toHaveLength(3)
  })

  it('maps a Git Changes snapshot', () => {
    expect(
      toRecordInput({
        worktreeId: 'w',
        cwd: '/r',
        reason: 'stashClear',
        paths: [],
        stashes: [{ index: 0, sha: 'abc', message: 'm' }],
        headSha: null,
      }),
    ).toEqual({
      worktreeId: 'w',
      cwd: '/r',
      reason: 'stashClear',
      paths: [],
      stashes: [{ sha: 'abc', message: 'm' }],
      headSha: null,
    })
  })
})
