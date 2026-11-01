import { render, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../src/components/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '../src/components/popover'
import { setOverlayGuardReporter } from '../src/lib/overlay-guard'

afterEach(() => setOverlayGuardReporter(null))

test("reporter receives +1/-1 with mode 'hide' around an open Dialog", async () => {
  const reporter = vi.fn()
  setOverlayGuardReporter(reporter)
  const ui = (open: boolean) => (
    <Dialog open={open}>
      <DialogContent>
        <DialogTitle>{'t'}</DialogTitle>
        <DialogDescription>{'d'}</DialogDescription>
      </DialogContent>
    </Dialog>
  )
  const { rerender } = render(ui(true))
  expect(reporter.mock.calls).toEqual([[1, 'hide']])
  rerender(ui(false))
  await waitFor(() => expect(reporter).toHaveBeenCalledTimes(2))
  expect(reporter.mock.calls).toEqual([
    [1, 'hide'],
    [-1, 'hide'],
  ])
})
test('Popover with guardMode="snapshot" reports mode snapshot', () => {
  const reporter = vi.fn()
  setOverlayGuardReporter(reporter)
  render(
    <Popover open>
      <PopoverTrigger>{'o'}</PopoverTrigger>
      <PopoverContent guardMode="snapshot">{'c'}</PopoverContent>
    </Popover>,
  )
  expect(reporter).toHaveBeenCalledWith(1, 'snapshot')
})
test('no reporter → no crash', () => {
  expect(() =>
    render(
      <Popover open>
        <PopoverContent>{'c'}</PopoverContent>
      </Popover>,
    ),
  ).not.toThrow()
})
