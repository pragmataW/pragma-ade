import { afterEach, describe, expect, test, vi } from 'vitest'

// The cold-capture case the QA run hit: a page captured right after it loaded took ~300 ms.
const COLD_CAPTURE_MS = 300

import { CoreIpc } from '../src/common/core-ipc'
import type { Rect } from '../src/common/shell'
import { SNAPSHOT_CAPTURE_TIMEOUT_MS, SNAPSHOT_CLEAR_DELAY_MS, SNAPSHOT_PAINT_DELAY_MS } from '../src/constants'
import { DuplicateViewError, NativeViewHost, type NativeViewLike } from '../src/runtime/main/native-view-host'

const TAB_RECT: Rect = { x: 10, y: 20, width: 300, height: 200 }

function fakeView() {
  const view = {
    bounds: [] as Rect[],
    visible: [] as boolean[],
    setBounds: (r: Rect) => view.bounds.push(r),
    setVisible: (v: boolean) => view.visible.push(v),
    capture: vi.fn<() => Promise<string>>(async () => 'data:x'),
  }
  return view satisfies NativeViewLike
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

const MENU_BELOW = { mode: 'hide' as const, rect: { x: 20, y: 240, width: 100, height: 80 } }
const MENU_OVER = { mode: 'hide' as const, rect: { x: 250, y: 150, width: 100, height: 80 } }
const MODAL = { mode: 'hide' as const, rect: null }
const NONE = { covers: [] }

/** With fake timers: lets a cover's snapshot paint delay pass, then waits for the cover to finish. */
async function settle(p: Promise<void>): Promise<void> {
  await vi.advanceTimersByTimeAsync(SNAPSHOT_PAINT_DELAY_MS)
  await p
}

function covered() {
  const s = setup()
  s.host.setTabBounds('t', TAB_RECT)
  const v = fakeView()
  s.host.attach('a', v, { panelTabId: 't' })
  return { ...s, v }
}

describe('overlay occlusion', () => {
  afterEach(() => vi.useRealTimers())

  test('an overlay that does not intersect the view leaves it alone', async () => {
    const { host, v, publish } = covered()
    await host.setOcclusion({ covers: [MENU_BELOW] })
    expect(host.state('a')?.visible).toBe(true)
    expect(v.visible).toEqual([true])
    expect(v.capture).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
  })

  test.each([
    ['an intersecting menu', MENU_OVER],
    ['a modal backdrop (whole window)', MODAL],
  ])('%s: snapshot is published before the view hides; it is cleared only after the view is back', async (_l, c) => {
    vi.useFakeTimers()
    const { host, v, events, publish } = covered()
    const order: string[] = []
    v.setVisible = (on) => order.push(on ? 'show' : 'hide')
    publish.mockImplementation((c: { channel: string }) => order.push(c.channel))
    await settle(host.setOcclusion({ covers: [c] }))
    expect(events(CoreIpc.nativeViewsSnapshot.channel)).toEqual([{ viewId: 'a', bounds: TAB_RECT, dataUrl: 'data:x' }])
    expect(host.state('a')?.visible).toBe(false)
    await host.setOcclusion(NONE)
    expect(host.state('a')?.visible).toBe(true)
    expect(events(CoreIpc.nativeViewsSnapshotCleared.channel)).toHaveLength(0)
    vi.advanceTimersByTime(SNAPSHOT_CLEAR_DELAY_MS)
    expect(events(CoreIpc.nativeViewsSnapshotCleared.channel)).toEqual([{ viewId: 'a' }])
    const [snap, cleared] = [CoreIpc.nativeViewsSnapshot.channel, CoreIpc.nativeViewsSnapshotCleared.channel]
    expect(order).toEqual([snap, 'hide', 'show', cleared])
  })

  test('captures once per open overlay, even when it moves', async () => {
    const { host, v } = covered()
    await host.setOcclusion({ covers: [MENU_OVER] })
    await host.setOcclusion({ covers: [{ ...MENU_OVER, rect: { ...MENU_OVER.rect, x: 260 } }] })
    expect(v.capture).toHaveBeenCalledOnce()
  })

  test('the overlay moving off the view brings the view back', async () => {
    const { host } = covered()
    await host.setOcclusion({ covers: [MENU_OVER] })
    await host.setOcclusion({ covers: [MENU_BELOW] })
    expect(host.state('a')?.visible).toBe(true)
  })

  test('a slow or failing capture falls back to hiding without a snapshot', async () => {
    vi.useFakeTimers()
    const { host, v, events } = covered()
    v.capture.mockImplementation(() => new Promise<string>(() => undefined))
    const done = host.setOcclusion({ covers: [MENU_OVER] })
    await vi.advanceTimersByTimeAsync(SNAPSHOT_CAPTURE_TIMEOUT_MS)
    await done
    expect(host.state('a')?.visible).toBe(false)
    expect(events(CoreIpc.nativeViewsSnapshot.channel)).toHaveLength(0)
  })

  test.each([
    ['a hide cover with a capture slower than a frame (fresh page)', MENU_OVER, COLD_CAPTURE_MS],
    [
      'snapshot mode, however long the capture takes',
      { mode: 'snapshot' as const, rect: null },
      SNAPSHOT_CAPTURE_TIMEOUT_MS * 2,
    ],
  ])('%s keeps the view up until its snapshot is ready', async (_l, cover, wait) => {
    vi.useFakeTimers()
    const { host, v, events } = covered()
    let resolve: (s: string) => void = () => undefined
    v.capture.mockImplementation(() => new Promise<string>((r) => (resolve = r)))
    const done = host.setOcclusion({ covers: [cover] })
    await vi.advanceTimersByTimeAsync(wait)
    expect(host.state('a')?.visible).toBe(true)
    resolve('data:late')
    await settle(done)
    expect(events(CoreIpc.nativeViewsSnapshot.channel)).toEqual([
      { viewId: 'a', bounds: TAB_RECT, dataUrl: 'data:late' },
    ])
    expect(host.state('a')?.visible).toBe(false)
    expect(v.visible).toEqual([true, false])
  })

  test('closing the overlay while capturing never hides the view nor leaves a snapshot', async () => {
    const { host, v, events } = covered()
    let resolve: (s: string) => void = () => undefined
    v.capture.mockImplementation(() => new Promise<string>((r) => (resolve = r)))
    const opening = host.setOcclusion({ covers: [MENU_OVER] })
    await host.setOcclusion(NONE)
    resolve('data:x')
    await opening
    expect(v.visible).toEqual([true])
    expect(events(CoreIpc.nativeViewsSnapshot.channel)).toHaveLength(0)
  })

  test('reopening within the clear delay keeps the fresh snapshot', async () => {
    vi.useFakeTimers()
    const { host, events } = covered()
    await settle(host.setOcclusion({ covers: [MENU_OVER] }))
    await host.setOcclusion(NONE)
    await settle(host.setOcclusion({ covers: [MENU_OVER] }))
    vi.advanceTimersByTime(SNAPSHOT_CLEAR_DELAY_MS)
    expect(events(CoreIpc.nativeViewsSnapshotCleared.channel)).toHaveLength(0)
    expect(events(CoreIpc.nativeViewsSnapshot.channel)).toHaveLength(2)
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
  await host.setOcclusion({ covers: [MODAL] })
  await host.setOcclusion(NONE)
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
