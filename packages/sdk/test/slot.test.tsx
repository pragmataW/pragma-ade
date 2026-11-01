import { act, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { RendererHostContext } from '../src/renderer/context'
import { Slot } from '../src/renderer/Slot'
import { createRegistries } from '../src/runtime/renderer/registries'
import type { RendererHost } from '../src/runtime/renderer/renderer-host'

const setup = () => {
  const registries = createRegistries()
  const host = { registries } as unknown as RendererHost
  const ui = (node: React.ReactNode) => <RendererHostContext.Provider value={host}>{node}</RendererHostContext.Provider>
  return { registries, ui }
}
const Text = ({ label }: { label?: string }) => <span>{label ?? 'none'}</span>
const named = (label: string) => () => <span>{label}</span>
const Boom = () => {
  throw new Error('boom')
}

test('entries render sorted by order', () => {
  const { registries, ui } = setup()
  registries.registerSlot('s', { id: 'b', order: 20, component: named('B') })
  registries.registerSlot('s', { id: 'a', order: 10, component: named('A') })
  const { container } = render(ui(<Slot id="s" />))
  expect(container.textContent).toBe('AB')
})
test('single and match', () => {
  const { registries, ui } = setup()
  registries.registerSlot<{ kind: string }>('v', {
    id: 't',
    order: 1,
    component: named('T'),
    match: (p) => p.kind === 'terminal',
  })
  registries.registerSlot<{ kind: string }>('v', {
    id: 'c',
    order: 2,
    component: named('C'),
    match: (p) => p.kind === 'chat',
  })
  registries.registerSlot<{ kind: string }>('v', { id: 'any', order: 3, component: named('ANY') })
  const { container, rerender } = render(ui(<Slot id="v" props={{ kind: 'chat' }} single />))
  expect(container.textContent).toBe('C')
  rerender(ui(<Slot id="v" props={{ kind: 'chat' }} />))
  expect(container.textContent).toBe('CANY')
})
test('a crashing entry is isolated', () => {
  const { registries, ui } = setup()
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  registries.registerSlot('s', { id: 'boom', order: 1, component: Boom })
  registries.registerSlot('s', { id: 'ok', order: 2, component: named('OK') })
  render(ui(<Slot id="s" />))
  expect(screen.getByText('OK')).toBeInTheDocument()
  error.mockRestore()
})
test('fallback when empty; props are passed', () => {
  const { registries, ui } = setup()
  const { container } = render(ui(<Slot id="e" fallback={<i>{'f'}</i>} />))
  expect(container.textContent).toBe('f')
  act(() => void registries.registerSlot('p', { id: 'x', order: 1, component: Text }))
  render(ui(<Slot id="p" props={{ label: 'hello' }} />))
  expect(screen.getByText('hello')).toBeInTheDocument()
})
