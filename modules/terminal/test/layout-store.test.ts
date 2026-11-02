import { expect, test } from 'vitest'
import { MAX_PANES_PER_TAB, type WorktreeTerminalLayout } from '../src/contract'
import { leafIds, paneLeaf } from '../src/lib/layout-tree'
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

/** A tab split `count - 1` times side by side, plus its id. */
async function splitTab(count: number) {
  const ctx = setup()
  const tabId = (await ctx.store.createTab('w1')).tabs[0]?.id ?? ''
  for (let i = 1; i < count; i++) await ctx.store.split('w1', tabId, 'vertical')
  const tab = () => ctx.store.get('w1').tabs[0]
  return { ...ctx, tabId, tab }
}

test('split adds panes up to MAX_PANES_PER_TAB, then is a no-op', async () => {
  const { pty, store, tabId, tab } = await splitTab(MAX_PANES_PER_TAB)
  const full = store.get('w1')
  expect(tab()?.panes).toHaveLength(MAX_PANES_PER_TAB)
  expect(leafIds(tab()?.root ?? paneLeaf(''))).toEqual(tab()?.panes.map((p) => p.id))
  expect(tab()?.activePaneId).toBe(tab()?.panes.at(-1)?.id)
  expect(await store.split('w1', tabId, 'horizontal')).toBe(full)
  expect(pty.spawned).toHaveLength(MAX_PANES_PER_TAB)
})

test('split acts on the focused pane', async () => {
  const { store, tabId, tab } = await splitTab(2)
  const [left, right] = tab()?.panes ?? []
  store.focusPane('w1', tabId, left?.id ?? '')
  await store.split('w1', tabId, 'horizontal')
  const added = tab()?.panes[2]
  expect(tab()?.root).toEqual({
    kind: 'split',
    direction: 'vertical',
    children: [
      { kind: 'split', direction: 'horizontal', children: [paneLeaf(left?.id ?? ''), paneLeaf(added?.id ?? '')] },
      paneLeaf(right?.id ?? ''),
    ],
  })
  expect(tab()?.activePaneId).toBe(added?.id)
})

test('focusPane ignores unknown and already focused panes', async () => {
  const { store, tabId, tab, changes } = await splitTab(2)
  const before = changes.length
  store.focusPane('w1', tabId, 'nope')
  store.focusPane('w1', tabId, tab()?.activePaneId ?? '')
  expect(changes).toHaveLength(before)
})

test('a split whose tab closed during the spawn kills the new pty', async () => {
  const { pty, store } = setup()
  const tabId = (await store.createTab('w1')).tabs[0]?.id ?? ''
  const splitting = store.split('w1', tabId, 'vertical')
  store.closeTab('w1', tabId)
  await splitting
  expect(pty.killed.map((k) => k.ptyId)).toEqual(['pty-1', 'pty-2'])
  expect(store.get('w1').tabs).toEqual([])
})

test('closePane reflows, focuses the neighbour and kills the pty; the last pane removes the tab', async () => {
  const { pty, store, tabId, tab } = await splitTab(3)
  const [first, second, third] = tab()?.panes ?? []
  store.focusPane('w1', tabId, second?.id ?? '')
  const after = store.closePane('w1', tabId, second?.id ?? '').tabs[0]
  expect(after?.root).toEqual({
    kind: 'split',
    direction: 'vertical',
    children: [paneLeaf(first?.id ?? ''), paneLeaf(third?.id ?? '')],
  })
  expect(after?.activePaneId).toBe(third?.id)
  expect(pty.killed.map((k) => k.ptyId)).toEqual([second?.ptyId])
  expect(store.closePane('w1', tabId, third?.id ?? '').tabs[0]).toMatchObject({
    root: paneLeaf(first?.id ?? ''),
    panes: [first],
    activePaneId: first?.id,
  })
  expect(store.closePane('w1', tabId, first?.id ?? '')).toMatchObject({ tabs: [], activeTabId: null })
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
