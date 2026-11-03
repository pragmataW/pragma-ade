import type { IpcContract, IpcEventContract } from '@pragma/sdk'
import { describe, expect, it } from 'vitest'
import {
  type FoldersSnapshot,
  PROJECTS_CHANNELS,
  type ProjectsSnapshot,
  projectsIpcEvents,
  type StatusChangedPayload,
  type Worktree,
} from '../src/contract'
import { createProjectsRendererService } from '../src/renderer/renderer-service'
import {
  applySelected,
  applySnapshot,
  applyStatus,
  createProjectsStore,
  EMPTY_PROJECTS_STATE,
  filterWorktrees,
  type ProjectsIpc,
  selectActiveWorktree,
  selectFoldersOf,
  selectProjectOf,
  selectWorktreesOf,
} from '../src/renderer/store'
import { aProject, aWorktree } from './support/builders'

const project = { ...aProject({ id: 'p' }), sortOrder: 0 }
const main = aWorktree('p', { id: 'm', isMain: true })
const feat = aWorktree('p', { id: 'f' })
const other = aWorktree('q', { id: 'o' })
const snapshot = (over: Partial<ProjectsSnapshot> = {}): ProjectsSnapshot => ({
  projects: [project],
  worktrees: [main, feat, other],
  changedFiles: { m: 1 },
  sync: {},
  projectErrors: {},
  activeWorktreeId: 'm',
  ...over,
})
const status = (worktreeId: string, changedFiles: number): StatusChangedPayload => ({
  worktreeId,
  changedFiles,
  upstream: 'origin/main',
  ahead: 2,
  behind: 0,
})

const folder = { id: 'fo', name: 'Folder', collapsed: false, worktreeIds: ['f'] }
const storedFolders: FoldersSnapshot = { p: [folder] }

/** A fake renderer IPC: `getState` resolves on demand, `getFolders` at once, events are fired by the test. */
function fakeIpc() {
  const listeners = new Map<string, Set<(p: unknown) => void>>()
  const invoked: { channel: string; input: unknown }[] = []
  let resolveState: (s: ProjectsSnapshot) => void = () => undefined
  const ipc: ProjectsIpc = {
    invoke: <I, O>(c: IpcContract<I, O>, input: I): Promise<O> => {
      invoked.push({ channel: c.channel, input })
      if (c.channel === PROJECTS_CHANNELS.getFolders) return Promise.resolve(storedFolders as O)
      if (c.channel === PROJECTS_CHANNELS.getState)
        return new Promise((r) => {
          resolveState = r as (s: ProjectsSnapshot) => void
        })
      return Promise.resolve({ ok: true, value: undefined } as O)
    },
    subscribe: <P>(c: IpcEventContract<P>, cb: (p: P) => void) => {
      const set = listeners.get(c.channel) ?? new Set()
      listeners.set(c.channel, set)
      set.add(cb as (p: unknown) => void)
      return { dispose: () => set.delete(cb as (p: unknown) => void) }
    },
  }
  const fire = <P>(c: IpcEventContract<P>, p: P) => {
    for (const cb of listeners.get(c.channel) ?? []) cb(p)
  }
  return { ipc, invoked, fire, resolve: (s: ProjectsSnapshot) => resolveState(s), listeners }
}

describe('reducers', () => {
  it.each([
    ['applySnapshot', () => applySnapshot(EMPTY_PROJECTS_STATE, snapshot()), { hydrated: true, activeWorktreeId: 'm' }],
    [
      'applyStatus',
      () => applyStatus(applySnapshot(EMPTY_PROJECTS_STATE, snapshot()), status('f', 4)),
      { changedFiles: { m: 1, f: 4 }, sync: { f: { upstream: 'origin/main', ahead: 2, behind: 0 } } },
    ],
    ['applySelected', () => applySelected(EMPTY_PROJECTS_STATE, { worktreeId: 'f' }), { activeWorktreeId: 'f' }],
  ])('%s', (_name, run, expected) => expect(run()).toMatchObject(expected))

  it('selectors', () => {
    const s = applySnapshot(EMPTY_PROJECTS_STATE, snapshot())
    expect(selectWorktreesOf(s, 'p').map((w) => w.id)).toEqual(['m', 'f'])
    expect(selectActiveWorktree(s)?.id).toBe('m')
    expect(selectActiveWorktree(EMPTY_PROJECTS_STATE)).toBeNull()
    expect(selectProjectOf(s, 'f')?.id).toBe('p')
    expect(selectProjectOf(s, 'o')).toBeNull()
  })
})

describe('createProjectsStore', () => {
  it('buffers events that arrive before the snapshot and replays them after it', async () => {
    const f = fakeIpc()
    const { store, start } = createProjectsStore(f.ipc)
    const started = start()
    f.fire(projectsIpcEvents.statusChanged, status('m', 7))
    f.resolve(snapshot())
    await started
    expect(store.getState()).toMatchObject({ hydrated: true, changedFiles: { m: 7 } })
    f.fire(projectsIpcEvents.selected, { worktreeId: 'f' })
    expect(store.getState().activeWorktreeId).toBe('f')
    f.fire(projectsIpcEvents.stateChanged, snapshot({ activeWorktreeId: null }))
    expect(store.getState().activeWorktreeId).toBeNull()
  })

  it('hydrates the folders, keeps them across snapshots and follows foldersChanged', async () => {
    const f = fakeIpc()
    const { store, start } = createProjectsStore(f.ipc)
    const started = start()
    f.resolve(snapshot())
    await started
    expect(selectFoldersOf(store.getState(), 'p')).toEqual([folder])
    expect(selectFoldersOf(store.getState(), 'q')).toEqual([])
    f.fire(projectsIpcEvents.stateChanged, snapshot())
    expect(store.getState().folders).toEqual(storedFolders)
    f.fire(projectsIpcEvents.foldersChanged, {})
    expect(selectFoldersOf(store.getState(), 'p')).toEqual([])
  })

  it('stop unsubscribes', async () => {
    const f = fakeIpc()
    const { start, stop } = createProjectsStore(f.ipc)
    const started = start()
    f.resolve(snapshot())
    await started
    stop()
    expect([...f.listeners.values()].every((set) => set.size === 0)).toBe(true)
  })
})

describe('createProjectsRendererService', () => {
  it('notifies subscribers, exposes the active worktree and selects through IPC', async () => {
    const f = fakeIpc()
    const { store, start } = createProjectsStore(f.ipc)
    const service = createProjectsRendererService(store, f.ipc)
    let notified = 0
    const off = service.subscribe(() => notified++)
    const started = start()
    f.resolve(snapshot())
    await started
    expect(notified).toBeGreaterThan(0)
    expect(service.getActiveWorktree()).toEqual(main as Worktree)
    expect(service.getSnapshot()).toBe(service.getSnapshot())
    await service.selectWorktree('f')
    expect(f.invoked.at(-1)).toEqual({ channel: PROJECTS_CHANNELS.selectWorktree, input: { worktreeId: 'f' } })
    off()
  })
})

describe('filterWorktrees', () => {
  const named = { ...project, name: 'pragma-ade' }
  const trees = [
    aWorktree('p', { id: 'm', branch: 'main', isMain: true }),
    aWorktree('p', { id: 'f', branch: 'feat/Login' }),
  ]

  it('keeps everything for an empty or blank query', () => {
    expect(filterWorktrees(named, trees, '')).toEqual(trees)
    expect(filterWorktrees(named, trees, '  ')).toEqual(trees)
  })

  it('keeps every worktree when the project name matches', () => {
    expect(filterWorktrees(named, trees, 'ADE')).toEqual(trees)
  })

  it('otherwise keeps only branches that match, case-insensitively', () => {
    expect(filterWorktrees(named, trees, 'login').map((w) => w.id)).toEqual(['f'])
    expect(filterWorktrees(named, trees, 'nope')).toEqual([])
  })

  it('a detached worktree matches only through the project name', () => {
    const detached = [aWorktree('p', { id: 'd', branch: null })]
    expect(filterWorktrees(named, detached, 'd')).toEqual(detached)
    expect(filterWorktrees(named, detached, 'x')).toEqual([])
  })
})
