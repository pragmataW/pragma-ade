import { AGENTS_VIEW_ID } from '@pragma/module-agents/contract'
import { CoreCommands } from '@pragma/sdk'
import { fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStore } from 'zustand/vanilla'
import { BOARD_VIEW_ID, BOARD_TESTIDS as T } from '../../src/contract'
import { BackButton } from '../../src/renderer/components/BackButton'
import { type BoardRendererContext, setBoardCtx } from '../../src/renderer/lib/runtime'
import { isLeaveEscape, useEscapeLeavesBoard } from '../../src/renderer/lib/use-leave-board'
import { createViewHistory, type ViewRegistryState } from '../../src/renderer/lib/view-history'

const OTHER_VIEW = 'other-view'
const registry = (activeView: string, ids = [AGENTS_VIEW_ID, BOARD_VIEW_ID, OTHER_VIEW]) =>
  createStore<ViewRegistryState>(() => ({ activeView, views: ids.map((id) => ({ id })) }))

describe('view history (Back)', () => {
  const history = createViewHistory()
  afterEach(() => history.dispose())

  it('returns to the view the board was opened from', () => {
    const store = registry(OTHER_VIEW)
    history.track(store)
    store.setState({ activeView: BOARD_VIEW_ID })
    expect(history.boardShown()).toBe(true)
    expect(history.backTarget()).toBe(OTHER_VIEW)
  })

  it('falls back to the agents view when the board was never left from another view', () => {
    const store = registry(BOARD_VIEW_ID)
    history.track(store)
    expect(history.backTarget()).toBe(AGENTS_VIEW_ID)
  })

  it('falls back to the agents view when the previous view is no longer registered', () => {
    const store = registry(OTHER_VIEW)
    history.track(store)
    store.setState({ activeView: BOARD_VIEW_ID })
    store.setState({ views: [{ id: AGENTS_VIEW_ID }, { id: BOARD_VIEW_ID }] })
    expect(history.backTarget()).toBe(AGENTS_VIEW_ID)
  })

  it('subscribes once per store and ignores moves that do not open the board', () => {
    const store = registry(AGENTS_VIEW_ID)
    history.track(store)
    history.track(store)
    store.setState({ activeView: BOARD_VIEW_ID })
    store.setState({ activeView: BOARD_VIEW_ID })
    store.setState({ activeView: OTHER_VIEW })
    expect(history.boardShown()).toBe(false)
    store.setState({ activeView: BOARD_VIEW_ID })
    expect(history.backTarget()).toBe(OTHER_VIEW)
  })
})

describe('isLeaveEscape', () => {
  const press = (target: EventTarget, init: KeyboardEventInit = {}) => {
    let leave = false
    const onKey = (e: Event) => {
      leave = isLeaveEscape(e as KeyboardEvent, document)
    }
    document.addEventListener('keydown', onKey)
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, ...init }))
    document.removeEventListener('keydown', onKey)
    return leave
  }
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('a plain Esc on the board leaves it', () => {
    document.body.innerHTML = '<div id="board" tabindex="-1"></div>'
    expect(press(document.getElementById('board') as HTMLElement)).toBe(true)
  })

  it('not from a field, with a modifier, or over an open dialog', () => {
    document.body.innerHTML = '<input id="search" />'
    expect(press(document.getElementById('search') as HTMLElement)).toBe(false)
    expect(press(document.body, { metaKey: true })).toBe(false)
    expect(press(document.body, { key: 'Enter' })).toBe(false)
    document.body.innerHTML = '<div role="dialog"></div>'
    expect(press(document.body)).toBe(false)
  })
})

describe('Back button and the Esc listener', () => {
  const execute = vi.fn().mockResolvedValue(undefined)
  const leftForAgents = () => expect(execute).toHaveBeenCalledWith(CoreCommands.activateView, { id: AGENTS_VIEW_ID })
  afterEach(() => {
    execute.mockClear()
    setBoardCtx(undefined)
    document.body.innerHTML = ''
  })
  const withCtx = () => setBoardCtx({ commands: { execute } } as unknown as BoardRendererContext)

  it('Back with no earlier view activates the agents view', () => {
    withCtx()
    render(<BackButton />)
    fireEvent.click(screen.getByTestId(T.back))
    leftForAgents()
  })

  it('an Esc another handler already took does not leave; unmounting stops listening', () => {
    withCtx()
    const hook = renderHook(() => useEscapeLeavesBoard())
    const handled = (e: KeyboardEvent) => e.preventDefault()
    document.body.addEventListener('keydown', handled)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    document.body.removeEventListener('keydown', handled)
    expect(execute).not.toHaveBeenCalled()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    leftForAgents()
    execute.mockClear()
    hook.unmount()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(execute).not.toHaveBeenCalled()
  })
})
