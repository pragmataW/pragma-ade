import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../src/components/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../src/components/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '../src/components/popover'
import { type OverlayCover, setOverlayGuardReporter } from '../src/lib/overlay-guard'

/** Where jsdom pretends every element is (it has no layout). */
const MENU_RECT = { x: 10.4, y: 400.6, width: 160, height: 90 }
const MENU_COVER_RECT = { x: 10, y: 400, width: 161, height: 91 }

function stubRect(r: { x: number; y: number; width: number; height: number }) {
  const rect = { ...r, left: r.x, top: r.y, right: r.x + r.width, bottom: r.y + r.height, toJSON: () => r }
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect as DOMRect)
}

let reporter = vi.fn<(covers: OverlayCover[]) => void>()
const last = () => reporter.mock.lastCall?.[0]
beforeEach(() => {
  reporter = vi.fn()
  setOverlayGuardReporter(reporter)
  stubRect(MENU_RECT)
})
afterEach(() => {
  cleanup()
  setOverlayGuardReporter(null)
  vi.restoreAllMocks()
})

const menu = (open: boolean) => (
  <DropdownMenu open={open}>
    <DropdownMenuTrigger>{'⋯'}</DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem>{'Stop agent'}</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)

test('a reporter gets the current covers as soon as it is set', () => {
  expect(reporter.mock.calls).toEqual([[[]]])
})

test('a Dialog (modal backdrop) covers the whole window while open', async () => {
  const ui = (open: boolean) => (
    <Dialog open={open}>
      <DialogContent>
        <DialogTitle>{'t'}</DialogTitle>
        <DialogDescription>{'d'}</DialogDescription>
      </DialogContent>
    </Dialog>
  )
  const { rerender } = render(ui(true))
  expect(last()).toEqual([{ mode: 'hide', rect: null }])
  rerender(ui(false))
  await waitFor(() => expect(last()).toEqual([]))
})

test('a DropdownMenu covers only its own content box (rounded outwards)', async () => {
  const { rerender } = render(menu(true))
  await waitFor(() => expect(last()).toEqual([{ mode: 'hide', rect: MENU_COVER_RECT }]))
  rerender(menu(false))
  await waitFor(() => expect(last()).toEqual([]))
})

test('the cover follows the content while it moves; unchanged rects are not re-reported', async () => {
  render(menu(true))
  await waitFor(() => expect(last()).toEqual([{ mode: 'hide', rect: MENU_COVER_RECT }]))
  const calls = reporter.mock.calls.length
  await new Promise((r) => requestAnimationFrame(r))
  expect(reporter.mock.calls).toHaveLength(calls)
  stubRect({ ...MENU_RECT, x: 50 })
  await waitFor(() => expect(last()?.[0]?.rect).toEqual({ ...MENU_COVER_RECT, x: 50, width: 160 }))
})

test('Popover with guardMode="snapshot" reports mode snapshot', async () => {
  render(
    <Popover open>
      <PopoverTrigger>{'o'}</PopoverTrigger>
      <PopoverContent guardMode="snapshot">{'c'}</PopoverContent>
    </Popover>,
  )
  await waitFor(() => expect(last()).toEqual([{ mode: 'snapshot', rect: MENU_COVER_RECT }]))
})

test('no reporter → no crash', () => {
  setOverlayGuardReporter(null)
  expect(() =>
    render(
      <Popover open>
        <PopoverContent>{'c'}</PopoverContent>
      </Popover>,
    ),
  ).not.toThrow()
})

test('a closed Select covers nothing; open, it covers its listbox (Radix keeps closed content mounted)', async () => {
  const { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } = await import('../src/components/select')
  // jsdom has no layout: Radix scrolls the selected item into view when the Select opens.
  Element.prototype.scrollIntoView ??= () => undefined
  const ui = (open: boolean) => (
    <Select open={open} value="a">
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="a">{'A'}</SelectItem>
        <SelectItem value="b">{'B'}</SelectItem>
      </SelectContent>
    </Select>
  )
  const { rerender, unmount } = render(ui(false))
  expect(reporter.mock.calls.flat().every((covers) => covers.length === 0)).toBe(true)
  rerender(ui(true))
  await waitFor(() => expect(last()).toEqual([{ mode: 'hide', rect: MENU_COVER_RECT }]))
  rerender(ui(false))
  await waitFor(() => expect(last()).toEqual([]))
  unmount()
  expect(last()).toEqual([])
})
