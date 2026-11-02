import { describe, expect, it } from 'vitest'
import { type CliDeps, type CliIo, run } from '../src/main'

const ENDPOINT = { url: 'http://127.0.0.1:1', token: 't' }
const RESULT = { projectId: 'p1', worktrees: [] }

function harness(over: Partial<CliIo> = {}, files: Record<string, string> = {}) {
  const out = { stdout: '', stderr: '', calls: [] as { method: string; payload: unknown }[] }
  const io: CliIo = {
    env: {},
    cwd: '/repo/src',
    platform: 'darwin',
    home: '/home/u',
    stdout: (s) => {
      out.stdout += s
    },
    stderr: (s) => {
      out.stderr += s
    },
    readFile: async (p) => {
      const text = files[p]
      if (text === undefined) throw new Error(`ENOENT: ${p}`)
      return text
    },
    readStdin: async () => '# From stdin\n',
    ...over,
  }
  const deps: CliDeps = {
    version: '9.9.9',
    resolve: async () => ENDPOINT,
    call: async (_ep, method, payload) => {
      out.calls.push({ method, payload })
      return method === 'handoff' ? HANDOFF : RESULT
    },
  }
  return { io, deps, out }
}

const HANDOFF = {
  worktree: { id: 'w2', projectId: 'p1', branch: 'handoff/x', path: '/wt', isMain: false },
  createdWorktree: true,
  session: {
    id: 's2',
    worktreeId: 'w2',
    profileId: 'p',
    profileName: 'OpenCode',
    status: 'starting',
    title: null,
    createdAt: 1,
  },
  taskId: null,
  sourceTaskIds: [],
}

describe('run', () => {
  it('env context is attached and --worktree is not invented', async () => {
    const h = harness({ env: { PRAGMA_WORKTREE_ID: 'w1', PRAGMA_SESSION_ID: 's1' } })
    expect(await run(['worktree', 'list'], h.io, h.deps)).toBe(0)
    expect(h.out.calls[0]?.payload).toEqual({ context: { worktreeId: 'w1', sessionId: 's1', cwd: '/repo/src' } })
  })

  it('maps flags to payload fields', async () => {
    const h = harness()
    await run(['worktree', 'create', '--branch', 'b', '--base', 'main', '--project', 'p1'], h.io, h.deps)
    expect(h.out.calls[0]?.payload).toMatchObject({ branch: 'b', baseBranch: 'main', projectId: 'p1' })
  })

  it('--file - reads stdin and sameWorktree defaults to false', async () => {
    const h = harness()
    expect(await run(['handoff', '--to', 'oc', '--file', '-', '--task', '42'], h.io, h.deps)).toBe(0)
    expect(h.out.calls[0]?.payload).toMatchObject({ document: '# From stdin\n', sameWorktree: false, taskId: '42' })
    expect(h.out.stdout).toContain('Handed off to OpenCode')
  })

  it('task update maps the positional id and the description file', async () => {
    const h = harness({}, { '/repo/src/d.md': 'Details' })
    await run(['task', 'update', '42', '--description-file', 'd.md'], h.io, h.deps)
    expect(h.out.calls[0]).toMatchObject({ method: 'taskUpdate', payload: { taskId: '42', description: 'Details' } })
  })

  it.each([
    ['empty', { '/repo/src/h.md': '' }],
    ['missing', {}],
  ])('%s --file is a usage error (exit 2) naming the file', async (_name, files) => {
    const h = harness({}, files)
    expect(await run(['handoff', '--to', 'oc', '--file', 'h.md'], h.io, h.deps)).toBe(2)
    expect(h.out.stderr).toContain('/repo/src/h.md')
    expect(h.out.calls).toHaveLength(0)
  })

  it('--version prints the injected version', async () => {
    const h = harness()
    expect(await run(['--version'], h.io, h.deps)).toBe(0)
    expect(h.out.stdout).toBe('9.9.9\n')
  })

  it('usage errors in --json mode still print one JSON document', async () => {
    const h = harness()
    expect(await run(['task', 'move', '42', '--json'], h.io, h.deps)).toBe(2)
    expect(JSON.parse(h.out.stdout)).toMatchObject({ ok: false, error: { code: 'usage' } })
  })
})
