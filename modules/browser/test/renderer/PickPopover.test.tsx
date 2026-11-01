import { act, fireEvent, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { BROWSER_TEST_IDS as T } from '../../src/contract'
import { BrowserPanel } from '../../src/renderer/BrowserPanel'
import { buildPick, buildSnapshot, buildTab } from '../lib/builders'
import { fakeCommentsUi, renderBrowser } from '../lib/renderer'

interface PopoverProps {
  rect: { x: number; y: number; width: number; height: number }
  open: boolean
  onOpenChange(open: boolean): void
  guardMode?: string
  children: ReactNode
}
const popovers = vi.hoisted(() => [] as PopoverProps[])
vi.mock('@pragma/ui/components/anchored-popover', () => ({
  AnchoredPopover: (p: PopoverProps) => {
    popovers.push(p)
    return p.open ? <div role="dialog">{p.children}</div> : null
  },
}))

function open(pick = buildPick()) {
  const ui = fakeCommentsUi()
  const r = renderBrowser(<BrowserPanel />, { snapshot: buildSnapshot([buildTab()]), comments: ui })
  r.pick(pick)
  return { ...r, ui }
}
const lastContext = (ui: ReturnType<typeof fakeCommentsUi>) => ui.props.at(-1)?.context
const dismissed = (calls: { channel: string; input: unknown }[]) =>
  calls.filter((c) => c.channel === 'browser.pick.dismiss').map((c) => c.input)

describe('PickPopover', () => {
  it('renders selector, DOM path and the composer with the element context', () => {
    const { ui } = open(buildPick({ component: { name: 'SaveButton', source: 'src/Save.tsx:3:1' } }))
    const pop = screen.getByTestId(T.pickPopover)
    expect(pop).toHaveTextContent('#save')
    expect(pop).toHaveTextContent('body > main > button#save')
    expect(pop).toHaveTextContent('src/Save.tsx:3:1')
    expect(ui.props.at(-1)).toMatchObject({ worktreeId: 'wtA', context: { source: 'browser' } })
    expect(lastContext(ui)?.element).toMatchObject({
      screenshotPath: '/tmp/shots/p1.png',
      consoleErrors: expect.any(Array),
    })
  })

  it('unchecking both boxes drops screenshot, styles and console errors', () => {
    const { ui } = open()
    fireEvent.click(screen.getByTestId(T.pickAttachShot))
    fireEvent.click(screen.getByTestId(T.pickIncludeConsole))
    const element = lastContext(ui)?.element ?? {}
    for (const key of ['screenshotPath', 'styles', 'consoleErrors']) expect(Object.hasOwn(element, key)).toBe(false)
  })

  it('the console box is disabled without errors', () => {
    open(buildPick({ consoleErrors: [] }))
    expect(screen.getByTestId(T.pickIncludeConsole)).toBeDisabled()
    expect(screen.getByTestId(T.pickIncludeConsole)).not.toBeChecked()
  })

  it('composer onDone dismisses', () => {
    const { ui, calls } = open()
    act(() => ui.props.at(-1)?.onDone?.({ kind: 'cancelled' }))
    expect(dismissed(calls)).toEqual([{ pickId: 'p1' }])
    expect(screen.queryByTestId(T.pickPopover)).toBeNull()
  })

  it('Escape (onOpenChange false) dismisses', () => {
    const { calls } = open()
    act(() => popovers.at(-1)?.onOpenChange(false))
    expect(dismissed(calls)).toEqual([{ pickId: 'p1' }])
  })

  it('closes popover when pick tab disappears', () => {
    const { store } = open()
    act(() => store.getState().applySnapshot(buildSnapshot([buildTab({ id: 'other' })])))
    expect(screen.queryByTestId(T.pickPopover)).toBeNull()
  })

  it('uses the snapshot guard and the element rect in window coordinates', () => {
    const area = { x: 100, y: 60, width: 400, height: 300 }
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const r = this.dataset.testid === T.viewArea ? area : { x: 0, y: 0, width: 0, height: 0 }
      return { ...r, top: r.y, left: r.x, right: r.x + r.width, bottom: r.y + r.height, toJSON: () => r } as DOMRect
    })
    open()
    spy.mockRestore()
    expect(popovers.at(-1)).toMatchObject({ guardMode: 'snapshot', open: true })
    // pick rect {10,20,80,24} in an 800px viewport shown 400px wide at (100,60)
    expect(popovers.at(-1)?.rect).toEqual({ x: 105, y: 70, width: 40, height: 12 })
  })
})
