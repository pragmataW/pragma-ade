import { afterEach, describe, expect, it } from 'vitest'
import { GIT_DIR_IGNORE } from '../src/constants'
import { FsWatcher } from '../src/main/fs-watcher'
import { type GitDirWorktreeRef, mapGitDirPaths } from '../src/main/git-dir-map'
import { createCleanups } from './support/cleanups'
import { makeRepo } from './support/git-fixture'
import { waitFor } from './support/wait'

const refs: GitDirWorktreeRef[] = [
  { worktreeId: 'main', isMain: true, branch: 'main', baseBranch: 'origin/main', gitDirName: null },
  { worktreeId: 'feat', isMain: false, branch: 'feat', baseBranch: 'main', gitDirName: 'feat' },
]

describe('mapGitDirPaths', () => {
  it.each([
    ['HEAD', ['main']],
    ['index', ['main']],
    ['ORIG_HEAD', ['main']],
    ['worktrees/feat/index', ['feat']],
    ['worktrees/feat/HEAD', ['feat']],
    ['refs/heads/feat', ['feat']],
    ['refs/heads/main', ['main']],
    ['refs/remotes/origin/main', ['main']],
    // The branch's own upstream moved (push, fetch, publish): its ahead/behind changed.
    ['refs/remotes/origin/feat', ['feat']],
    ['refs/remotes/upstream/feat', ['feat']],
    ['refs/remotes/origin/other', []],
    ['packed-refs', ['main', 'feat']],
    ['FETCH_HEAD', []],
    // Remotes and upstreams live in config (`git remote add`, `push -u`): every worktree's sync state may change.
    ['config', ['main', 'feat']],
  ])('%s → %j', (path, ids) => expect(mapGitDirPaths([path], refs)).toEqual(ids))

  it('returns unique ids for a batch', () => {
    expect(mapGitDirPaths(['HEAD', 'index', 'refs/heads/main'], refs)).toEqual(['main'])
  })
})

describe('git dir watching', () => {
  const cleanups = createCleanups()
  const watcher = new FsWatcher({ debounceMs: 100, maxPaths: 500 })
  afterEach(async () => {
    await watcher.closeAll()
    cleanups.run()
  })

  it('a commit in the main checkout maps to the main worktree', async () => {
    const repo = cleanups.track(await makeRepo())
    const seen: string[][] = []
    await watcher.watch('git', `${repo.dir}/.git`, GIT_DIR_IGNORE, (paths) => void seen.push(paths))
    await repo.write('x.txt', 'x')
    await repo.commitAll('x')
    const mapped = await waitFor(() => seen.map((p) => mapGitDirPaths(p, refs)).find((ids) => ids.length > 0))
    expect(mapped).toEqual(['main'])
  })
})
