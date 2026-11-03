import { act, cleanup, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FOCUS_FLASH_CLASS, FOCUS_FLASH_MS, FOCUS_TIMEOUT_MS } from '../src/constants'
import { useRevealFocus } from '../src/renderer/diff/reveal-focus'
import { useGitChangesStore, viewOf } from '../src/renderer/store'

const WT = 'w'
const view = () => viewOf(useGitChangesStore.getState(), WT)

function Host({ ready, children }: { ready: boolean; children?: React.ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null)
  useRevealFocus(WT, scroller, ready)
  return <div ref={scroller}>{children}</div>
}

describe('useRevealFocus', () => {
  let scrolled: Element[]
  beforeEach(() => {
    vi.useFakeTimers()
    scrolled = []
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this)
    }
    useGitChangesStore.setState(useGitChangesStore.getInitialState(), true)
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('scrolls the focused thread card into view, flashes it and clears the focus', () => {
    useGitChangesStore.getState().reveal(WT, 'a.ts', ['a.ts'], { commentId: 'c1', line: 3 })
    const { getByTestId } = render(
      <Host ready>
        <div data-testid="card" data-comment-id="c1" />
      </Host>,
    )
    const card = getByTestId('card')
    expect(scrolled).toEqual([card])
    expect(card).toHaveClass(FOCUS_FLASH_CLASS)
    expect(view().focus).toBeNull()
    act(() => vi.advanceTimersByTime(FOCUS_FLASH_MS))
    expect(card).not.toHaveClass(FOCUS_FLASH_CLASS)
  })

  it('waits for the diff to render the card, then gives up after the timeout', () => {
    useGitChangesStore.getState().reveal(WT, 'a.ts', ['a.ts'], { commentId: 'late' })
    const { rerender, getByTestId } = render(<Host ready />)
    expect(scrolled).toEqual([])
    rerender(
      <Host ready>
        <div data-testid="card" data-comment-id="late" />
      </Host>,
    )
    act(() => vi.advanceTimersByTime(FOCUS_TIMEOUT_MS / 10))
    expect(scrolled).toEqual([getByTestId('card')])
    act(() => useGitChangesStore.getState().reveal(WT, 'a.ts', ['a.ts'], { commentId: 'never' }))
    act(() => vi.advanceTimersByTime(FOCUS_TIMEOUT_MS))
    expect(view().focus).toBeNull()
  })

  it('does nothing until the contents are loaded', () => {
    useGitChangesStore.getState().reveal(WT, 'a.ts', ['a.ts'], { commentId: 'c1' })
    render(
      <Host ready={false}>
        <div data-comment-id="c1" />
      </Host>,
    )
    expect(scrolled).toEqual([])
    expect(view().focus).not.toBeNull()
  })
})
