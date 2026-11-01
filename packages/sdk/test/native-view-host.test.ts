import { describe, expect, it, test, vi } from 'vitest'
import { CoreIpc } from '../src/common/core-ipc'
import type { Rect } from '../src/common/shell'
import { DuplicateViewError, NativeViewHost, type NativeViewLike } from '../src/runtime/main/native-view-host'

const TAB_RECT: Rect = { x: 10, y: 20, width: 300, height: 200 }

function fakeView(): NativeViewLike & { bounds: Rect[]; visible: boolean[] } {
  const view = {
    bounds: [] as Rect[],
    visible: [] as boolean[],
    setBounds: (r: Rect) => view.bounds.push(r),
    setVisible: (v: boolean) => view.visible.push(v),
    capture: vi.fn(async () => 'data:x'),
  }
  return view
}
function fakeContainer() {
  return {
    added: [] as NativeViewLike[],
    removed: [] as NativeViewLike[],
    add(v: NativeViewLike) {
      this.added.push(v)
    },
    remove(v: NativeViewLike) {
      this.removed.push(v)
    },
  }
}
function setup() {
  const container = fakeContainer()
  const publish = vi.fn()
  const host = new NativeViewHost(container, publish)
  const events = (channel: string) => publish.mock.calls.filter(([c]) => c.channel === channel).map(([, p]) => p)
  return { container, publish, host, events }
}

test('attach adds to container; hidden until tab bounds known', () => {
  const { host, container } = setup()
  const v = fakeView()
  host.attach('a', v, { panelTabId: 't' })
  expect(container.added).toEqual([v])
  expect(host.state('a')).toEqual({ bounds: null, visible: false })
  host.setTabBounds('t', TAB_RECT)
  expect(host.state('a')).toEqual({ bounds: TAB_RECT, visible: true })
})
test('inset is subtracted from tab rect', () => {
  const { host } = setup()
  const v = fakeView()
  host.attach('a', v, { panelTabId: 't', inset: { top: 30, left: 5 } })
  host.setTabBounds('t', TAB_RECT)
  expect(v.bounds.at(-1)).toEqual({ x: 15, y: 50, width: 295, height: 170 })
})
test('attach/show keep a single visible view per tab', () => {
  const { host } = setup()
  host.setTabBounds('t', TAB_RECT)
  host.attach('a', fakeView(), { panelTabId: 't' })
  host.attach('b', fakeView(), { panelTabId: 't' })
  expect([host.state('a')?.visible, host.state('b')?.visible]).toEqual([false, true])
  host.show('a')
  expect([host.state('a')?.visible, host.state('b')?.visible]).toEqual([true, false])
})
test('hide hides only that view', () => {
  const { host } = setup()
  host.setTabBounds('t', TAB_RECT)
  host.setTabBounds('u', TAB_RECT)
  host.attach('a', fakeView(), { panelTabId: 't' })
  host.attach('b', fakeView(), { panelTabId: 'u' })
  host.hide('a')
  expect([host.state('a')?.visible, host.state('b')?.visible]).toEqual([false, true])
})
test('null tab bounds hides', () => {
  const { host } = setup()
  host.setTabBounds('t', TAB_RECT)
  const v = fakeView()
  host.attach('a', v, { panelTabId: 't' })
  host.setTabBounds('t', null)
  expect(host.state('a')?.visible).toBe(false)
  expect(v.visible.at(-1)).toBe(false)
})

describe('overlay snapshot', () => {
  it.each([
    ['hide', { hide: true, snapshot: false }, 0],
    ['snapshot', { hide: false, snapshot: true }, 1],
  ])('%s mode', async (_mode, occlusion, snapshots) => {
    const { host, events } = setup()
    host.setTabBounds('t', TAB_RECT)
    const v = fakeView()
    host.attach('a', v, { panelTabId: 't' })
    await host.setOcclusion(occlusion)
    expect(host.state('a')?.visible).toBe(false)
    expect(events(CoreIpc.nativeViewsSnapshot.channel)).toHaveLength(snapshots)
    if (snapshots)
      expect(events(CoreIpc.nativeViewsSnapshot.channel)[0]).toEqual({
        viewId: 'a',
        bounds: TAB_RECT,
        dataUrl: 'data:x',
      })
    await host.setOcclusion({ hide: false, snapshot: false })
    expect(host.state('a')?.visible).toBe(true)
    expect(events(CoreIpc.nativeViewsSnapshotCleared.channel)).toHaveLength(snapshots)
  })
})
test('freeze/unfreeze', async () => {
  const { host, events } = setup()
  host.setTabBounds('t', TAB_RECT)
  const v = fakeView()
  host.attach('a', v, { panelTabId: 't' })
  await host.freeze('a')
  expect(v.capture).toHaveBeenCalledOnce()
  expect(events(CoreIpc.nativeViewsSnapshot.channel)).toHaveLength(1)
  expect(host.state('a')?.visible).toBe(false)
  await host.setOcclusion({ hide: true, snapshot: false })
  await host.setOcclusion({ hide: false, snapshot: false })
  expect(host.state('a')?.visible).toBe(false)
  expect(events(CoreIpc.nativeViewsSnapshotCleared.channel)).toHaveLength(0)
  await host.unfreeze('a')
  expect(host.state('a')?.visible).toBe(true)
  expect(events(CoreIpc.nativeViewsSnapshotCleared.channel)).toEqual([{ viewId: 'a' }])
})
test('detach removes', () => {
  const { host, container } = setup()
  const v = fakeView()
  const d = host.attach('a', v, { panelTabId: 't' })
  d.dispose()
  expect(container.removed).toEqual([v])
  expect(host.state('a')).toBeUndefined()
  expect(host.viewIds()).toEqual([])
})
test('duplicate viewId throws', () => {
  const { host } = setup()
  host.attach('a', fakeView(), { panelTabId: 't' })
  expect(() => host.attach('a', fakeView(), { panelTabId: 't' })).toThrow(DuplicateViewError)
})
test('reattachAll', () => {
  const { host, container } = setup()
  host.setTabBounds('t', TAB_RECT)
  const v = fakeView()
  host.attach('a', v, { panelTabId: 't' })
  const before = v.bounds.length
  host.reattachAll()
  expect(container.added).toEqual([v, v])
  expect(v.bounds.length).toBe(before + 1)
})
test('rounds fractional bounds', () => {
  const { host } = setup()
  const v = fakeView()
  host.attach('a', v, { panelTabId: 't' })
  host.setTabBounds('t', { x: 10.4, y: 20.6, width: 99.5, height: 50.2 })
  expect(v.bounds.at(-1)).toEqual({ x: 10, y: 21, width: 100, height: 50 })
  host.setTabBounds('t', { x: 10.4, y: 20.6, width: 99.5, height: 50.2 })
  expect(v.bounds).toHaveLength(1)
})
