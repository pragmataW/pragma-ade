import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createTempUserData, memoryLogger } from '@pragma/test-support'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WORKTREE_IGNORE } from '../src/constants'
import { FsWatcher } from '../src/main/fs-watcher'
import { createCleanups } from './support/cleanups'
import { canonical } from './support/git-fixture'
import { sleep, waitFor } from './support/wait'

const cleanups = createCleanups()
let dir: string
let watcher: FsWatcher
let batches: { paths: string[]; truncated: boolean }[]
beforeEach(() => {
  dir = canonical(cleanups.track(createTempUserData()).path)
  watcher = new FsWatcher({ debounceMs: 100, maxPaths: 2, log: memoryLogger() })
  batches = []
})
afterEach(async () => {
  await watcher.closeAll()
  cleanups.run()
})
const record = (paths: string[], truncated: boolean) => void batches.push({ paths, truncated })

describe('FsWatcher', () => {
  it('batches writes within the debounce window and caps the paths', async () => {
    await watcher.watch('k', dir, WORKTREE_IGNORE, record)
    for (const name of ['a.txt', 'b.txt', 'c.txt']) writeFileSync(join(dir, name), name)
    await waitFor(() => batches.length > 0)
    await sleep(250)
    expect(batches).toHaveLength(1)
    expect(batches[0]?.paths).toHaveLength(2)
    expect(batches[0]?.truncated).toBe(true)
  })

  it('ignores node_modules', async () => {
    mkdirSync(join(dir, 'node_modules', 'x'), { recursive: true })
    await watcher.watch('k', dir, WORKTREE_IGNORE, record)
    writeFileSync(join(dir, 'node_modules', 'x', 'y.js'), 'y')
    await sleep(400)
    expect(batches).toEqual([])
  })

  it('reports relative paths and stops after unwatch', async () => {
    await watcher.watch('k', dir, WORKTREE_IGNORE, record)
    mkdirSync(join(dir, 'sub'))
    writeFileSync(join(dir, 'sub', 'f.txt'), 'f')
    await waitFor(() => batches.some((b) => b.paths.includes('sub/f.txt')))
    await watcher.unwatch('k')
    batches.splice(0)
    writeFileSync(join(dir, 'later.txt'), 'x')
    await sleep(400)
    expect(batches).toEqual([])
  })

  it('watch on a missing dir resolves and is idempotent per key', async () => {
    await expect(watcher.watch('missing', join(dir, 'nope'), [], record)).resolves.toBeUndefined()
    await watcher.watch('k', dir, [], record)
    await watcher.watch('k', dir, [], record)
    writeFileSync(join(dir, 'once.txt'), 'x')
    await waitFor(() => batches.length > 0)
    await sleep(250)
    expect(batches).toHaveLength(1)
  })
})
