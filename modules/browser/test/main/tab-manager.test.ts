import { describe, expect, it } from 'vitest'
import { EXTERNAL_OPEN_MIN_INTERVAL_MS } from '../../src/constants'
import { BrowserError } from '../../src/contract'
import { navEvent, setupManager } from '../lib/builders'

describe('BrowserTabManager', () => {
  it('creates views in the worktree partition', () => {
    const { host, manager } = setupManager()
    const t = manager.openTab('wtA')
    expect(host.calls).toContain('createView:persist:wt-wtA')
    expect(host.calls).toContain(`attach:browser:${t}`)
  })

  it("shows only the active worktree's active tab", async () => {
    const { host, manager, last } = setupManager()
    manager.setActiveWorktree('wtA')
    const t1 = manager.openTab('wtA')
    const t2 = manager.openTab('wtB')
    // attaching t2 shows it in the SDK; the manager puts t1 back
    expect(host.calls.at(-1)).toBe(`show:browser:${t1}`)
    manager.setActiveWorktree('wtB')
    expect(host.calls.at(-1)).toBe(`show:browser:${t2}`)
    manager.setActiveWorktree('wtC')
    expect(host.calls.at(-1)).toBe(`hide:browser:${t2}`)
    expect((await last()).worktrees.wtA?.tabIds).toEqual([t1])
  })

  it('hides the view on a main-frame load error and shows it on the next load', async () => {
    const { host, manager, last } = setupManager()
    manager.setActiveWorktree('wtA')
    const t = manager.openTab('wtA')
    const g = host.guestOf(t)
    g.emit('did-fail-load', {}, -105, 'NAME_NOT_RESOLVED', 'http://x/', true)
    expect(host.calls.at(-1)).toBe(`hide:browser:${t}`)
    expect((await last()).tabs[t]?.loadError).toEqual({ code: -105, description: 'NAME_NOT_RESOLVED' })
    g.emit('did-start-loading')
    expect(host.calls.at(-1)).toBe(`show:browser:${t}`)
    expect((await last()).tabs[t]?.loadError).toBeNull()
  })

  it.each([
    ['ERR_ABORTED', -3, true],
    ['a subframe', -105, false],
  ])('ignores load errors of %s', async (_, code, main) => {
    const { host, manager, last } = setupManager()
    const t = manager.openTab('wtA')
    host.guestOf(t).emit('did-fail-load', {}, code, 'x', 'http://x/', main)
    expect((await last()).tabs[t]?.loadError).toBeNull()
  })

  it.each([
    ['page-title-updated', [{}, 'Hello'], { title: 'Hello' }],
    ['did-start-loading', [], { isLoading: true }],
    ['did-stop-loading', [], { isLoading: false, url: 'http://localhost:1/x', canGoBack: true }],
    ['did-navigate', [{}, 'http://localhost:1/x'], { url: 'http://localhost:1/x', canGoBack: true }],
    ['page-favicon-updated', [{}, ['http://localhost:1/f.ico']], { faviconUrl: 'http://localhost:1/f.ico' }],
  ])('publishes %s', async (event, args, expected) => {
    const { host, manager, last } = setupManager()
    const t = manager.openTab('wtA')
    const g = host.guestOf(t)
    g.url = 'http://localhost:1/x'
    g.history.back = true
    g.emit(event, ...args)
    expect((await last()).tabs[t]).toMatchObject(expected)
  })

  it('window.open opens internal urls in a new tab', async () => {
    const { host, manager, last } = setupManager()
    manager.setActiveWorktree('wtA')
    const t = manager.openTab('wtA')
    expect(host.guestOf(t).windowOpen?.({ url: 'http://localhost:1/p2' })).toEqual({ action: 'deny' })
    const s = await last()
    const added = s.worktrees.wtA?.activeTabId as string
    expect(added).not.toBe(t)
    expect(host.guestOf(added).loaded).toEqual(['http://localhost:1/p2'])
  })

  it('routes external schemes to the OS', async () => {
    const { host, manager, last } = setupManager()
    const t = manager.openTab('wtA')
    host.guestOf(t).windowOpen?.({ url: 'mailto:a@b.c' })
    expect(host.externals).toEqual(['mailto:a@b.c'])
    expect((await last()).worktrees.wtA?.tabIds).toEqual([t])
  })

  it.each(['will-navigate', 'will-redirect', 'will-frame-navigate'])(
    'blocks file: and javascript: navigations (%s)',
    (event) => {
      const { host, manager } = setupManager()
      const g = host.guestOf(manager.openTab('wtA'))
      for (const url of ['file:///etc/hosts', 'javascript:alert(1)']) {
        const e = navEvent(url)
        g.emit(event, e)
        expect(e.prevented).toBe(true)
      }
      const internal = navEvent('http://localhost:1/')
      g.emit(event, internal)
      expect(internal.prevented).toBe(false)
      expect(host.externals).toEqual([])
    },
  )

  it('blocks external schemes in subframes without opening them', () => {
    const { host, manager } = setupManager()
    const e = navEvent('zoommtg://join', false)
    host.guestOf(manager.openTab('wtA')).emit('will-frame-navigate', e)
    expect(e.prevented).toBe(true)
    expect(host.externals).toEqual([])
  })

  it('rate-limits external opens', () => {
    const { host, manager } = setupManager()
    const g = host.guestOf(manager.openTab('wtA'))
    g.emit('will-navigate', navEvent('zoommtg://join'))
    host.clock += EXTERNAL_OPEN_MIN_INTERVAL_MS - 1
    g.emit('will-navigate', navEvent('zoommtg://join'))
    expect(host.externals).toEqual(['zoommtg://join'])
    host.clock += 1
    g.emit('will-navigate', navEvent('zoommtg://join'))
    expect(host.externals).toHaveLength(2)
  })

  it('buffers console messages per tab', () => {
    const { host, manager } = setupManager({ consoleBufferSize: 3 })
    const t = manager.openTab('wtA')
    const g = host.guestOf(t)
    for (const [level, message] of [
      ['error', 'e1'],
      ['info', 'i1'],
      ['error', 'e2'],
      ['error', 'e3'],
      ['error', 'e4'],
    ])
      g.emit('console-message', { level, message, lineNumber: 1, sourceId: 's' })
    expect(manager.consoleErrors(t, 2).map((e) => e.message)).toEqual(['e3', 'e4'])
    expect(manager.consoleErrors(t, 10).map((e) => e.message)).toEqual(['e2', 'e3', 'e4'])
    expect(manager.consoleErrors(manager.openTab('wtA'), 2)).toEqual([])
  })

  it('discards least-recently-shown hidden views past maxLiveViews', async () => {
    const { host, manager, last } = setupManager({ maxLiveViews: 2 })
    manager.setActiveWorktree('wtA')
    const t1 = manager.openTab('wtA', 'http://localhost:1/one')
    const g1 = host.guestOf(t1)
    manager.openTab('wtA')
    manager.openTab('wtA')
    expect(g1.calls).toContain('close')
    expect(host.calls).toContain(`detach:browser:${t1}`)
    expect((await last()).tabs[t1]?.discarded).toBe(true)
    manager.activateTab(t1)
    const revived = host.guestOf(t1)
    expect(revived).not.toBe(g1)
    expect(revived.loaded).toEqual(['http://localhost:1/one'])
    expect((await last()).tabs[t1]?.discarded).toBe(false)
  })

  it('removeWorktree closes tabs, fires onTabClosed and clears the partition', async () => {
    const { host, manager, last } = setupManager()
    const closed: string[] = []
    manager.onTabClosed((id) => closed.push(id))
    const ids = [manager.openTab('wtA'), manager.openTab('wtA')]
    await manager.removeWorktree('wtA')
    expect(closed).toEqual(ids)
    expect(host.calls).toContain('clearPartition:persist:wt-wtA')
    expect((await last()).worktrees.wtA).toBeUndefined()
  })

  it('closing the active tab activates its neighbour', async () => {
    const { manager, last } = setupManager()
    const [a, b, c] = [manager.openTab('wtA'), manager.openTab('wtA'), manager.openTab('wtA')]
    manager.activateTab(b)
    manager.closeTab(b)
    expect((await last()).worktrees.wtA).toEqual({ tabIds: [a, c], activeTabId: c })
  })

  it('devtools state follows the events', async () => {
    const { host, manager, last } = setupManager()
    const t = manager.openTab('wtA')
    expect(manager.toggleDevTools(t)).toBe(true)
    host.guestOf(t).emit('devtools-opened')
    expect((await last()).tabs[t]?.devToolsOpen).toBe(true)
    expect(manager.toggleDevTools(t)).toBe(false)
    host.guestOf(t).emit('devtools-closed')
    expect((await last()).tabs[t]?.devToolsOpen).toBe(false)
  })

  it.each([
    ['in', 1, 1.1],
    ['out', 0.5, 0.5],
    ['out', 1, 0.9],
    ['in', 3, 3],
    ['reset', 2, 1],
  ] as const)('zoom %s from %s → %s', (action, from, to) => {
    const { host, manager } = setupManager()
    const t = manager.openTab('wtA')
    manager.snapshot()
    while (manager.snapshot().tabs[t]?.zoomFactor !== from)
      manager.zoom(t, from > (manager.snapshot().tabs[t]?.zoomFactor ?? 1) ? 'in' : 'out')
    expect(manager.zoom(t, action)).toBe(to)
    expect(host.guestOf(t).zoomFactor).toBe(to)
  })

  it.each([
    ['back', 'goBack'],
    ['forward', 'goForward'],
    ['reload', 'reload'],
    ['stop', 'stop'],
  ] as const)('history %s', (action, call) => {
    const { host, manager } = setupManager()
    const t = manager.openTab('wtA')
    const g = host.guestOf(t)
    g.history = { back: true, forward: true }
    manager.history(t, action)
    expect(g.calls).toEqual([call])
  })

  it('navigate normalizes input and rejects non-web schemes', () => {
    const { host, manager } = setupManager({ searchUrl: 'file:///{query}' })
    const t = manager.openTab('wtA')
    expect(manager.navigate(t, '3000')).toBe('http://localhost:3000/')
    expect(host.guestOf(t).loaded).toEqual(['http://localhost:3000/'])
    expect(() => manager.navigate(t, 'two words')).toThrow(BrowserError)
    expect(() => manager.navigate(t, '  ')).toThrow(/invalidInput/)
  })

  it('unknown tabs throw tabNotFound', () =>
    expect(() => setupManager().manager.closeTab('nope')).toThrow(expect.objectContaining({ code: 'tabNotFound' })))

  it('coalesces snapshot emits', async () => {
    const { manager, emits } = setupManager()
    manager.openTab('wtA')
    manager.openTab('wtA')
    await new Promise((r) => setTimeout(r, 0))
    expect(emits).toHaveLength(1)
  })
})
