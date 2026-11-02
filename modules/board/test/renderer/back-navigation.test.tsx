import { AGENTS_VIEW_ID } from '@pragma/module-agents/contract'
import { CoreCommands } from '@pragma/sdk'
import { fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BOARD_TESTIDS as T } from '../../src/contract'
import { BackButton } from '../../src/renderer/components/BackButton'
import { type BoardRendererContext, setBoardCtx } from '../../src/renderer/lib/runtime'
import { useEscapeToLeave } from '../../src/renderer/lib/use-escape-to-leave'

const esc = (target: Element = document.body, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(target, { key: 'Escape', ...init })

function mountEscape() {
  const leave = vi.fn()
  const hook = renderHook(() => useEscapeToLeave(leave))
  return { leave, hook }
}

afterEach(() => {
  document.body.innerHTML = ''
  setBoardCtx(undefined)
})

describe('Esc leaves the board', () => {
  it('a plain Esc leaves', () => {
    const { leave } = mountEscape()
    esc()
    expect(leave).toHaveBeenCalledTimes(1)
  })

  it('not while typing in a field', () => {
    const { leave } = mountEscape()
    for (const tag of ['input', 'textarea']) {
      const field = document.body.appendChild(document.createElement(tag))
      esc(field)
    }
    expect(leave).not.toHaveBeenCalled()
  })

  it('not while a drawer, dialog or menu is open', () => {
    const { leave } = mountEscape()
    for (const role of ['dialog', 'menu', 'listbox']) {
      const overlay = document.body.appendChild(document.createElement('div'))
      overlay.setAttribute('role', role)
      esc()
      overlay.remove()
    }
    expect(leave).not.toHaveBeenCalled()
  })

  it('not when a handler already took the Esc, or with modifiers, or other keys', () => {
    const { leave } = mountEscape()
    const handled = (e: KeyboardEvent) => e.preventDefault()
    document.body.addEventListener('keydown', handled)
    esc()
    document.body.removeEventListener('keydown', handled)
    esc(document.body, { metaKey: true })
    fireEvent.keyDown(document.body, { key: 'Enter' })
    expect(leave).not.toHaveBeenCalled()
  })

  it('stops listening when the board unmounts', () => {
    const { leave, hook } = mountEscape()
    hook.unmount()
    esc()
    expect(leave).not.toHaveBeenCalled()
  })
})

describe('Back button', () => {
  it('activates the agents view', () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    setBoardCtx({ commands: { execute } } as unknown as BoardRendererContext)
    render(<BackButton />)
    fireEvent.click(screen.getByTestId(T.back))
    expect(execute).toHaveBeenCalledWith(CoreCommands.activateView, { id: AGENTS_VIEW_ID })
  })
})
