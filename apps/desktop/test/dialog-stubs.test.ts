import { expect, it, vi } from 'vitest'
import { createStubbedDialogs } from '../src/main/dialog-stubs'

const real = () => ({
  openFolder: vi.fn(async () => '/real'),
  openFile: vi.fn(async () => ['/real.txt']),
  confirm: vi.fn(async () => false),
})

it.each([
  ['scalar reuse', { openFolder: '/stub' }, ['/stub', '/stub', '/stub'], 0],
  ['array consumption then fall-through', { openFolder: ['/a', null] }, ['/a', null, '/real'], 1],
  ['fall-through without a stub', {}, ['/real', '/real', '/real'], 3],
] as const)('%s', async (_name, stubs, expected, realCalls) => {
  const r = real()
  const { dialogs } = createStubbedDialogs(r, structuredClone(stubs) as never)
  const got = [await dialogs.openFolder({}), await dialogs.openFolder({}), await dialogs.openFolder({})]
  expect(got).toEqual(expected)
  expect(r.openFolder).toHaveBeenCalledTimes(realCalls)
})
it('setStubs replaces stubs at runtime', async () => {
  const { dialogs, setStubs } = createStubbedDialogs(real(), { confirm: true })
  expect(await dialogs.confirm({ title: '', message: '', confirmLabel: '', cancelLabel: '' })).toBe(true)
  setStubs({ confirm: [false] })
  expect(await dialogs.confirm({ title: '', message: '', confirmLabel: '', cancelLabel: '' })).toBe(false)
})
