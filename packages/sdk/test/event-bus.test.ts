import { expect, test, vi } from 'vitest'
import { defineEvent } from '../src/common/events'
import { createEventBus } from '../src/runtime/main/event-bus'
import { memoryLogger } from './lib/builders'

const Created = defineEvent<{ id: string }>('worktree.created')

test('delivers payloads to listeners until disposed', () => {
  const bus = createEventBus(memoryLogger())
  const cb = vi.fn()
  const d = bus.on(Created, cb)
  bus.emit(Created, { id: 'a' })
  d.dispose()
  bus.emit(Created, { id: 'b' })
  expect(cb.mock.calls).toEqual([[{ id: 'a' }]])
})
test('a throwing listener is isolated and logged', () => {
  const log = memoryLogger()
  const bus = createEventBus(log)
  const cb = vi.fn()
  bus.on(Created, () => {
    throw new Error('boom')
  })
  bus.on(Created, cb)
  bus.emit(Created, { id: 'a' })
  expect(cb).toHaveBeenCalledOnce()
  expect(log.messages('error')).toEqual(['listener of worktree.created threw'])
})
