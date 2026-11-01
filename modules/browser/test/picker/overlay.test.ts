// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { PickerDebugState, PickOutcome } from '../../src/main/picker/page/types'
import { buildPickerScript } from '../../src/main/picker/script'
import { hoverAndClick, mount, q, resetPicker, run, SCRIPT_OPTS } from '../lib/builders'

const awaitPick = () => run<Promise<PickOutcome>>(buildPickerScript('awaitPick', SCRIPT_OPTS))
const debugState = () => run<PickerDebugState>(buildPickerScript('debugState', SCRIPT_OPTS))

beforeEach(() => {
  resetPicker()
  mount('<button id="b" style="width:80px;height:20px">x</button>')
  run(buildPickerScript('arm', SCRIPT_OPTS))
})
afterEach(resetPicker)

it('installs one closed-shadow host', () => {
  run(buildPickerScript('arm', SCRIPT_OPTS))
  const hosts = document.querySelectorAll('[data-pragma-picker-host]')
  expect(hosts).toHaveLength(1)
  expect((hosts[0] as HTMLElement).shadowRoot).toBeNull()
})

it('shows the hover box on the element under the pointer', () => {
  hoverAndClick(q('#b'), { click: false })
  expect(debugState()).toEqual({ armed: true, hoverSelector: '#b', boxVisible: true, marks: 0 })
})

it('swallows clicks: the page handler never runs', async () => {
  const onClick = vi.fn()
  q('#b').addEventListener('click', onClick)
  const p = awaitPick()
  hoverAndClick(q('#b'))
  await expect(p).resolves.toMatchObject({ kind: 'picked', element: { selector: '#b' }, nonce: 'nonce-1' })
  expect(onClick).not.toHaveBeenCalled()
})

it('Escape cancels and removes the host', async () => {
  const p = awaitPick()
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  await expect(p).resolves.toEqual({ kind: 'cancelled' })
  expect(document.querySelector('[data-pragma-picker-host]')).toBeNull()
  expect(debugState().armed).toBe(false)
})

it('keeps a mark after pick and tags the element with the nonce', async () => {
  const p = awaitPick()
  hoverAndClick(q('#b'))
  await p
  expect(debugState()).toMatchObject({ armed: false, marks: 1 })
  expect(q('#b').dataset.pragmaPick).toBe(SCRIPT_OPTS.nonce)
  expect(document.querySelector('[data-pragma-picker-host]')).toBeNull()
  run(buildPickerScript('teardown', SCRIPT_OPTS))
  expect(debugState().marks).toBe(0)
})

it('hide/show toggles the overlay visibility', () => {
  run(buildPickerScript('hideOverlay', SCRIPT_OPTS))
  expect(q('[data-pragma-picker-host]').style.visibility).toBe('hidden')
  run(buildPickerScript('showOverlay', SCRIPT_OPTS))
  expect(q('[data-pragma-picker-host]').style.visibility).toBe('')
})

it('a pick before awaitPick is kept for the next await', async () => {
  hoverAndClick(q('#b'))
  await expect(awaitPick()).resolves.toMatchObject({ kind: 'picked' })
})
