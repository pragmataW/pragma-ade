import { expect, test } from 'vitest'
import type { WorktreeTerminalLayout } from '../src/contract'
import { TerminalLayoutStore } from '../src/main/layout-store'
import { fakePtyService } from './support/factories'

const PATHS: Record<string, string> = { w1: '/repo/w1', w2: '/repo/w2' }

function setup() {
  const pty = fakePtyService()
  const changes: WorktreeTerminalLayout[] = []
  let id = 0
  const store = new TerminalLayoutStore({
    pty,
    getWorktreePath: async (w) => PATHS[w] ?? '/missing',
    onChange: (l) => changes.push(l),
    idGen: () => `id-${++id}`,
  })
  return { pty, store, changes }
}

test('createTab spawns in the worktree path with panel tags; ordinals 1, 2', async () => {
  const { pty, store } = setup()
  await store.createTab('w1')
  const layout = await store.createTab('w1')
  expect(pty.spawned.map((s) => [s.cwd, s.tags])).toEqual([
    ['/repo/w1', { owner: 'terminal', worktreeId: 'w1' }],
    ['/repo/w1', { owner: 'terminal', worktreeId: 'w1' }],
  ])
  expect(layout.tabs.map((t) => t.ordinal)).toEqual([1, 2])
  expect(layout.activeTabId).toBe(layout.tabs[1]?.id)
})

test('closing the active tab activates its neighbour and kills its ptys', async () => {
  const { pty, store } = setup()
  await store.createTab('w1')
  await store.createTab('w1')
  const full = await store.createTab('w1')
  const [a, b, c] = full.tabs
  store.activateTab('w1', b?.id ?? '')
  const after = store.closeTab('w1', b?.id ?? '')
  expect(after.tabs.map((t) => t.id)).toEqual([a?.id, c?.id])
  expect(after.activeTabId).toBe(c?.id)
  expect(pty.killed.map((k) => k.ptyId)).toEqual([b?.panes[0]?.ptyId])
  expect(store.closeTab('w1', c?.id ?? '').activeTabId).toBe(a?.id)
})

test.each([
  ['  build ', 'build'],
  ['   ', null],
])('rename %j → customTitle %j', async (title, expected) => {
  const { store } = setup()
  const tabId = (await store.createTab('w1')).tabs[0]?.id ?? ''
  expect(store.renameTab('w1', tabId, title).tabs[0]?.customTitle).toBe(expected)
})

test('second split is a no-op', async () => {
  const { pty, store } = setup()
  const tabId = (await store.createTab('w1')).tabs[0]?.id ?? ''
  const split = await store.split('w1', tabId, 'vertical')
  expect(split.tabs[0]).toMatchObject({ split: 'vertical', activePaneId: split.tabs[0]?.panes[1]?.id })
  const again = await store.split('w1', tabId, 'horizontal')
  expect(again).toBe(split)
  expect(pty.spawned).toHaveLength(2)
})

test('closePane collapses split; closing the last pane removes the tab', async () => {
  const { store } = setup()
  const tabId = (await store.createTab('w1')).tabs[0]?.id ?? ''
  const split = await store.split('w1', tabId, 'horizontal')
  const [first, second] = split.tabs[0]?.panes ?? []
  const collapsed = store.closePane('w1', tabId, second?.id ?? '')
  expect(collapsed.tabs[0]).toMatchObject({ split: 'none', panes: [first], activePaneId: first?.id })
  const removed = store.closePane('w1', tabId, first?.id ?? '')
  expect(removed).toMatchObject({ tabs: [], activeTabId: null })
})

test('handleExit marks the pane and emits onChange', async () => {
  const { store, changes } = setup()
  const ptyId = (await store.createTab('w1')).tabs[0]?.panes[0]?.ptyId ?? ''
  const before = changes.length
  store.handleExit({ ptyId, exitCode: 3, signal: null, reason: 'exited' })
  expect(changes).toHaveLength(before + 1)
  expect(store.get('w1').tabs[0]?.panes[0]?.exit).toEqual({ exitCode: 3, signal: null, reason: 'exited' })
})

test('disposeWorktree kills only that worktree’s panel ptys', async () => {
  const { pty, store } = setup()
  await store.createTab('w1')
  await store.createTab('w2')
  const agent = await pty.spawn({ cwd: '/repo/w1', cols: 80, rows: 24, tags: { owner: 'agents', worktreeId: 'w1' } })
  const w1Pty = store.get('w1').tabs[0]?.panes[0]?.ptyId
  store.disposeWorktree('w1')
  expect(pty.killed.map((k) => k.ptyId)).toEqual([w1Pty])
  expect(pty.get(agent)).toBeDefined()
  expect(store.get('w1').tabs).toEqual([])
  expect(store.get('w2').tabs).toHaveLength(1)
})

test('spawn failure yields a pane with error and empty ptyId', async () => {
  const { pty, store } = setup()
  pty.failNextSpawn('boom')
  const layout = await store.createTab('w1')
  expect(layout.tabs[0]?.panes[0]).toMatchObject({ ptyId: '', error: 'boom', exit: null })
})
