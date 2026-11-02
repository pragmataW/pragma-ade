import { renderHook } from '@testing-library/react'
import type { Terminal } from '@xterm/xterm'
import { expect, test, vi } from 'vitest'
import { SHIFT_ENTER_SEQUENCE } from '../../src/constants'
import { useTerminalFeatures } from '../../src/renderer/view/use-terminal-features'

type KeyHandler = (e: KeyboardEvent) => boolean

function fakeTerminal() {
  let handler: KeyHandler = () => true
  const input = vi.fn()
  const term = {
    loadAddon: vi.fn(),
    hasSelection: () => false,
    getSelection: () => '',
    input,
    attachCustomKeyEventHandler: (h: KeyHandler) => {
      handler = h
    },
  }
  return { term: term as unknown as Terminal, input, press: (e: KeyboardEvent) => handler(e) }
}

function setup() {
  const fake = fakeTerminal()
  const { result } = renderHook(() => useTerminalFeatures())
  result.current.onTerminal(fake.term)
  return fake
}

const key = (type: string, init: KeyboardEventInit) => new KeyboardEvent(type, { cancelable: true, ...init })

test('Shift+Enter writes ESC CR once and suppresses xterm for every event of the key', () => {
  const { input, press } = setup()
  const down = key('keydown', { key: 'Enter', shiftKey: true })
  expect(press(down)).toBe(false)
  expect(down.defaultPrevented).toBe(true)
  expect(press(key('keypress', { key: 'Enter', shiftKey: true }))).toBe(false)
  expect(press(key('keyup', { key: 'Enter', shiftKey: true }))).toBe(false)
  expect(input).toHaveBeenCalledTimes(1)
  expect(input).toHaveBeenCalledWith(SHIFT_ENTER_SEQUENCE, true)
})

test('plain Enter and composing Shift+Enter stay with xterm', () => {
  const { input, press } = setup()
  expect(press(key('keydown', { key: 'Enter' }))).toBe(true)
  expect(press(key('keypress', { key: 'Enter' }))).toBe(true)
  expect(press(key('keydown', { key: 'Enter', shiftKey: true, isComposing: true }))).toBe(true)
  expect(input).not.toHaveBeenCalled()
})
