import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PICKER_WORLD_ID } from '../../src/constants'
import { BrowserPickSchema } from '../../src/contract'
import { deferred, flush, setupPicker, validRaw } from '../lib/builders'

const picked = (element = validRaw()) => ({ kind: 'picked' as const, element, nonce: 'n' })

describe('PickerService', () => {
  it('picks: saves png, emits a parseable BrowserPick, freezes after showOverlay', async () => {
    const t = setupPicker()
    const done = t.picker.start(t.tabId)
    await flush()
    expect(t.events.armed).toEqual([t.tabId])
    expect((await t.last()).pickerArmedTabId).toBe(t.tabId)
    t.outcome(picked())
    await done
    const pick = BrowserPickSchema.parse(t.events.picked[0])
    expect(pick).toMatchObject({ selector: '#b', tabId: t.tabId, worktreeId: 'wtA', component: null })
    expect(pick.url).toBe('http://localhost:1/index.html?token=%5Bredacted%5D')
    expect(existsSync(pick.screenshotPath as string)).toBe(true)
    expect(readFileSync(pick.screenshotPath as string).subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const order = t.host.calls.filter((c) => c.startsWith('iso:') || c.startsWith('freeze'))
    expect(order).toEqual([
      'iso:arm',
      'iso:awaitPick',
      'iso:hideOverlay',
      'iso:showOverlay',
      `freeze:browser:${t.tabId}`,
    ])
    expect(t.events.armed.at(-1)).toBeNull()
    expect(t.events.cancelled).toEqual([])
    t.picker.dismiss(pick.pickId)
    t.picker.dismiss(pick.pickId)
    await flush()
    expect(t.host.calls.filter((c) => c.startsWith('unfreeze'))).toEqual([`unfreeze:browser:${t.tabId}`])
  })

  it.each([
    [true, 1],
    [false, 0],
  ])('uses the isolated world for overlay scripts (reactProbe %s)', async (reactProbe, probes) => {
    const t = setupPicker({ reactProbe })
    t.guest.mainWorldReply = { name: 'SaveButton', source: 'src/SaveButton.tsx:3:1' }
    const done = t.picker.start(t.tabId)
    await flush()
    t.outcome(picked())
    await done
    expect(t.guest.isolatedCalls.every((c) => c.worldId === PICKER_WORLD_ID)).toBe(true)
    expect(t.guest.mainWorldCalls).toHaveLength(probes)
    expect(t.events.picked[0]?.component).toEqual(
      reactProbe ? { name: 'SaveButton', source: 'src/SaveButton.tsx:3:1' } : null,
    )
  })

  it('includes the last consoleErrorsInComment errors', async () => {
    const t = setupPicker({ consoleErrorsInComment: 2 })
    for (const message of ['a', 'b', 'c'])
      t.guest.emit('console-message', { level: 'error', message, lineNumber: 1, sourceId: 'http://localhost:1/x.js' })
    const done = t.picker.start(t.tabId)
    await flush()
    t.outcome(picked())
    await done
    expect(t.events.picked[0]?.consoleErrors).toEqual([
      '[error] b (http://localhost:1/x.js:1)',
      '[error] c (http://localhost:1/x.js:1)',
    ])
  })

  it('cancels on main-frame navigation', async () => {
    const t = setupPicker()
    const done = t.picker.start(t.tabId)
    await flush()
    t.guest.emit('did-start-navigation', { isMainFrame: true, isSameDocument: false, url: 'http://localhost:1/2' })
    await done
    expect(t.events.cancelled).toEqual([{ tabId: t.tabId, reason: 'navigation' }])
    expect(t.events.armed.at(-1)).toBeNull()
    expect(t.guest.listenerCount('did-start-navigation')).toBe(0)
  })

  it('ignores in-page navigation', async () => {
    const t = setupPicker()
    void t.picker.start(t.tabId)
    await flush()
    t.guest.emit('did-start-navigation', { isMainFrame: true, isSameDocument: true, url: 'http://localhost:1/#x' })
    t.guest.emit('did-start-navigation', { isMainFrame: false, isSameDocument: false, url: 'http://localhost:1/f' })
    await flush()
    expect(t.events.cancelled).toEqual([])
    expect(t.events.armed.at(-1)).toBe(t.tabId)
  })

  it('Escape in the page cancels with reason user', async () => {
    const t = setupPicker()
    const done = t.picker.start(t.tabId)
    await flush()
    t.outcome({ kind: 'cancelled' })
    await done
    expect(t.events.cancelled).toEqual([{ tabId: t.tabId, reason: 'user' }])
  })

  it('cancel() runs the page cancel and reports user', async () => {
    const t = setupPicker()
    const done = t.picker.start(t.tabId)
    await flush()
    t.picker.cancel(t.tabId)
    await done
    expect(t.host.calls).toContain('iso:cancel')
    expect(t.events.cancelled).toEqual([{ tabId: t.tabId, reason: 'user' }])
  })

  it('an invalid payload cancels with reason error', async () => {
    const t = setupPicker()
    const done = t.picker.start(t.tabId)
    await flush()
    t.outcome(picked(validRaw({ rect: { x: Number.NaN, y: 0, width: 1, height: 1 } })))
    await done
    expect(t.events.cancelled).toEqual([{ tabId: t.tabId, reason: 'error' }])
  })

  it('cancels when webContents destroyed, including during an in-flight capture', async () => {
    const t = setupPicker()
    const capture = deferred<void>()
    t.guest.capture.wait = capture.promise
    t.guest.capture.error = new Error('target gone')
    const done = t.picker.start(t.tabId)
    await flush()
    t.outcome(picked())
    await flush()
    t.guest.emit('destroyed')
    capture.resolve()
    await done
    expect(t.events.cancelled).toEqual([{ tabId: t.tabId, reason: 'destroyed' }])
    expect(t.events.picked).toEqual([])
  })

  it('screenshot failure still yields a pick', async () => {
    const t = setupPicker()
    t.guest.capture.error = new Error('no surface')
    const done = t.picker.start(t.tabId)
    await flush()
    t.outcome(picked())
    await done
    expect(t.events.picked[0]?.screenshotPath).toBeNull()
  })

  it('drops picks of closed tabs', async () => {
    const t = setupPicker()
    const done = t.picker.start(t.tabId)
    await flush()
    t.outcome(picked())
    await done
    const pickId = t.events.picked[0]?.pickId as string
    expect(t.picker.get(pickId)).toBeDefined()
    t.manager.closeTab(t.tabId)
    expect(t.picker.get(pickId)).toBeUndefined()
  })

  it('a pending pick on a closing tab ends as destroyed', async () => {
    const t = setupPicker()
    const done = t.picker.start(t.tabId)
    await flush()
    t.manager.closeTab(t.tabId)
    await done
    expect(t.events.cancelled).toEqual([{ tabId: t.tabId, reason: 'destroyed' }])
  })

  it('unknown tabs reject with tabNotFound', async () =>
    expect(setupPicker().picker.start('nope')).rejects.toMatchObject({ code: 'tabNotFound' }))
})
