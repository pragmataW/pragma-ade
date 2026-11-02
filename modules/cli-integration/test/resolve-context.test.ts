import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveProjectId, resolveWorktree } from '../src/main/resolve-context'
import { aWorktree, context, fakeProjects } from './support/fakes'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

/** Real dirs: `<tmp>/repo` (main, w1) and `<tmp>/repo/.wt/feat` (nested worktree w2). */
function onDisk() {
  const root = mkdtempSync(join(tmpdir(), 'pragma-ctx-'))
  dirs.push(root)
  const main = join(root, 'repo')
  const nested = join(main, '.wt', 'feat')
  mkdirSync(join(nested, 'src', 'deep'), { recursive: true })
  mkdirSync(join(main, 'src', 'deep'), { recursive: true })
  const projects = fakeProjects({
    worktrees: [aWorktree('w1', { path: main, isMain: true }), aWorktree('w2', { path: nested })],
    activeId: 'w1',
  })
  return { main, nested, projects }
}

describe('resolveWorktree', () => {
  const projects = fakeProjects({ worktrees: [aWorktree('w1'), aWorktree('w2')], activeId: 'w1' })

  it.each([
    ['explicit beats env', 'w2', context({ worktreeId: 'w1' }), 'w2'],
    ['env beats cwd and active', undefined, context({ worktreeId: 'w2' }), 'w2'],
    ['falls back to the active worktree', undefined, context(), 'w1'],
  ])('%s', async (_name, explicit, ctx, expected) => {
    expect((await resolveWorktree(projects, explicit, ctx)).id).toBe(expected)
  })

  it('cwd inside a worktree subdir resolves it', async () => {
    const d = onDisk()
    expect((await resolveWorktree(d.projects, undefined, context({ cwd: join(d.main, 'src', 'deep') }))).id).toBe('w1')
  })

  it('nested worktree paths pick the longest prefix', async () => {
    const d = onDisk()
    const ctx = context({ cwd: join(d.nested, 'src', 'deep') })
    expect((await resolveWorktree(d.projects, undefined, ctx)).id).toBe('w2')
  })

  it('nothing → invalid_argument', async () => {
    const none = fakeProjects({ worktrees: [aWorktree('w1')], activeId: null })
    await expect(resolveWorktree(none, undefined, context())).rejects.toMatchObject({ code: 'invalid_argument' })
  })

  it('unknown id → not_found', async () => {
    await expect(resolveWorktree(projects, 'nope', context())).rejects.toMatchObject({ code: 'not_found' })
  })
})

describe('resolveProjectId', () => {
  const projects = fakeProjects({ worktrees: [aWorktree('w1'), aWorktree('w9', { projectId: 'p9' })] })

  it.each([
    ['explicit id', 'p1', context(), 'p1'],
    ['project of the resolved worktree', undefined, context({ worktreeId: 'w9' }), 'p9'],
  ])('%s', async (_name, explicit, ctx, expected) => {
    expect(await resolveProjectId(projects, explicit, ctx)).toBe(expected)
  })

  it('unknown project → not_found', async () => {
    await expect(resolveProjectId(projects, 'nope', context())).rejects.toMatchObject({ code: 'not_found' })
  })

  it('nothing → invalid_argument', async () => {
    await expect(resolveProjectId(projects, undefined, context())).rejects.toMatchObject({ code: 'invalid_argument' })
  })
})
