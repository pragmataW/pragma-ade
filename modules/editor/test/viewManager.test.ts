import { describe, expect, it } from 'vitest'
import { ViewManager } from '../src/main/views/viewManager'
import { type FakeView, fakeNativeViews, fakeView } from './support/fakeViews'

const wt = (n: number) => ({ id: `w${n}`, path: `/work/w${n}` })

function setup(o: { ready?: boolean; max?: number } = {}) {
  const nv = fakeNativeViews()
  const views: FakeView[] = []
  const state = { port: o.ready === false ? undefined : 4711, max: o.max ?? 4 }
  const vm = new ViewManager({
    nativeViews: nv.api,
    createView: () => {
      const v = fakeView()
      views.push(v)
      return v
    },
    url: (p) => (state.port ? `http://127.0.0.1:${state.port}/?folder=${p}` : undefined),
    maxViews: () => state.max,
    onViewCreated: () => undefined,
  })
  return { nv, views, vm, state }
}

describe('ViewManager', () => {
  it('first show attaches with panelTabId files and shows', () => {
    const { nv, vm, views } = setup()
    vm.show(wt(1))
    expect(nv.calls).toEqual(['attach:editor.wt.w1:files', 'show:editor.wt.w1'])
    expect(views[0]?.loads).toEqual(['http://127.0.0.1:4711/?folder=/work/w1'])
  })

  it('second worktree show → show(second), first stays attached', () => {
    const { nv, vm } = setup()
    vm.show(wt(1))
    vm.show(wt(2))
    expect(nv.calls.at(-1)).toBe('show:editor.wt.w2')
    expect(nv.attached.has('editor.wt.w1')).toBe(true)
    expect(vm.openViews().map((v) => [v.worktreeId, v.shown])).toEqual([
      ['w2', true],
      ['w1', false],
    ])
  })

  it('fifth worktree with max 4 detaches and closes the LRU view', () => {
    const { nv, vm, views } = setup()
    for (const n of [1, 2, 3, 4, 5]) vm.show(wt(n))
    expect(nv.calls).toContain('detach:editor.wt.w1')
    expect(views[0]?.closed).toBe(true)
    expect(vm.openViews()).toHaveLength(4)
  })

  it('showing an evicted worktree creates a new view', () => {
    const { vm, views } = setup()
    for (const n of [1, 2, 3, 4, 5]) vm.show(wt(n))
    vm.show(wt(1))
    expect(views).toHaveLength(6)
    expect(vm.openViews()[0]?.webContentsId).toBe(views[5]?.webContents.id)
  })

  it('destroy on worktree removal', () => {
    const { nv, vm, views } = setup()
    vm.show(wt(1))
    vm.destroy('w1')
    expect(nv.calls.at(-1)).toBe('detach:editor.wt.w1')
    expect(views[0]?.closed).toBe(true)
    expect(vm.folderKeyToWorktree('/work/w1')).toBeUndefined()
  })

  it('reloadAll loads the new url', () => {
    const { vm, views, state } = setup()
    vm.show(wt(1))
    state.port = 5000
    vm.reloadAll()
    expect(views[0]?.loads.at(-1)).toBe('http://127.0.0.1:5000/?folder=/work/w1')
  })

  it('show while url undefined defers load until reloadAll', () => {
    const { vm, views, state } = setup({ ready: false })
    vm.show(wt(1))
    expect(views[0]?.loads).toEqual([])
    state.port = 4711
    vm.reloadAll()
    expect(views[0]?.loads).toHaveLength(1)
  })

  it('show with visible false attaches hidden; setMax evicts', () => {
    const { nv, vm } = setup()
    vm.show(wt(1))
    vm.show(wt(2), { visible: false })
    expect(nv.calls.slice(-2)).toEqual(['attach:editor.wt.w2:files', 'hide:editor.wt.w2'])
    vm.setMax(1)
    expect(vm.openViews().map((v) => v.worktreeId)).toEqual(['w2'])
  })
})
