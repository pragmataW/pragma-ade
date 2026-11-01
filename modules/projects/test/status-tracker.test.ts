import { memoryLogger } from '@pragma/test-support'
import { describe, expect, it } from 'vitest'
import type { GitService, GitStatus } from '../src/contract'
import { StatusTracker } from '../src/main/status-tracker'

const status = (over: Partial<GitStatus> = {}, files = 0): GitStatus => ({
  branch: 'main',
  oid: 'abc',
  upstream: 'origin/main',
  ahead: 0,
  behind: 0,
  entries: Array.from({ length: files }, (_, i) => ({ kind: 'untracked', path: `f${i}`, index: '?', worktree: '?' })),
  ...over,
})

/** A fake `GitService` whose `status` answers are queued and released on demand. */
function fakeGit() {
  const pending: ((s: GitStatus) => void)[] = []
  let calls = 0
  const git = {
    status: () => {
      calls++
      return new Promise<GitStatus>((r) => pending.push(r))
    },
  } as unknown as GitService
  return {
    git,
    calls: () => calls,
    release: async (s: GitStatus) => {
      while (pending.length === 0) await new Promise((r) => setTimeout(r, 1))
      pending.shift()?.(s)
    },
  }
}

function tracker() {
  const f = fakeGit()
  const statuses: unknown[] = []
  const branches: unknown[] = []
  const t = new StatusTracker({
    git: f.git,
    onStatus: (id, s) => void statuses.push({ id, ...s }),
    onBranch: (id, b) => void branches.push([id, b]),
  })
  return { ...f, t, statuses, branches }
}

describe('StatusTracker', () => {
  it('coalesces concurrent refreshes into at most two status calls', async () => {
    const x = tracker()
    const all = Promise.all([x.t.refresh('w', '/w'), x.t.refresh('w', '/w'), x.t.refresh('w', '/w')])
    await x.release(status())
    await x.release(status())
    await all
    expect(x.calls()).toBe(2)
  })

  it('fires onStatus only on count or sync changes and keeps the sync state', async () => {
    const x = tracker()
    const step = async (s: GitStatus) => {
      const p = x.t.refresh('w', '/w')
      await x.release(s)
      await p
    }
    await step(status({}, 0))
    await step(status({}, 2))
    await step(status({}, 2))
    expect(x.statuses).toHaveLength(2)
    await step(status({ ahead: 1 }, 2))
    expect(x.statuses).toHaveLength(3)
    expect(x.t.getSync('w')).toEqual({ upstream: 'origin/main', ahead: 1, behind: 0 })
    expect(x.t.get('w')).toBe(2)
  })

  it('fires onBranch when the branch changes (not on first sight); forget clears', async () => {
    const x = tracker()
    for (const branch of ['main', 'main', 'dev']) {
      const p = x.t.refresh('w', '/w')
      await x.release(status({ branch }))
      await p
    }
    expect(x.branches).toEqual([['w', 'dev']])
    x.t.forget('w')
    expect(x.t.get('w')).toBeNull()
    expect(x.t.getSync('w')).toBeNull()
  })

  it('a status failure is swallowed', async () => {
    const git = { status: async () => Promise.reject(new Error('boom')) } as unknown as GitService
    const t = new StatusTracker({ git, onStatus: () => undefined, onBranch: () => undefined })
    await expect(t.refresh('w', '/w')).resolves.toBeUndefined()
    expect(t.get('w')).toBeNull()
  })

  it('a throwing listener is logged and does not reject refresh', async () => {
    const f = fakeGit()
    const log = memoryLogger()
    const t = new StatusTracker({
      git: f.git,
      log,
      onStatus: () => {
        throw new Error('db closed')
      },
      onBranch: () => undefined,
    })
    const p = t.refresh('w', '/w')
    await f.release(status())
    await expect(p).resolves.toBeUndefined()
    expect(log.messages('warn')).toContain('status listener failed')
  })

  it('dispose waits for the run in flight, drops its result and makes later refreshes no-ops', async () => {
    const x = tracker()
    const first = x.t.refresh('w', '/w')
    void x.t.refresh('w', '/w')
    let disposed = false
    const disposing = x.t.dispose().then(() => {
      disposed = true
    })
    await new Promise((r) => setTimeout(r, 5))
    expect(disposed).toBe(false)
    await x.release(status())
    await Promise.all([first, disposing])
    expect(x.statuses).toEqual([])
    await x.t.refresh('w', '/w')
    expect(x.calls()).toBe(1)
  })
})
