import { createCommandRegistry } from '@pragma/sdk/runtime/main'
import { memoryLogger } from '@pragma/test-support'
import { describe, expect, it, vi } from 'vitest'
import {
  createNotifier,
  defaultNotifierPorts,
  type NotificationsPort,
  registerOpenSessionCommand,
} from '../src/main/notifier'
import { sessionInfo } from './support/builders'

function notifier(o: { focused?: boolean; enabled?: boolean } = {}) {
  const shown: Parameters<NotificationsPort['show']>[0][] = []
  const n = createNotifier({
    port: { show: (x) => shown.push(x) },
    focus: { isAppFocused: () => o.focused ?? false },
    enabled: () => o.enabled ?? true,
    describe: async () => ({ agentName: 'Claude Code', branch: 'feat/x' }),
  })
  return { n, shown }
}
const flush = () => new Promise((r) => setTimeout(r, 0))
const waiting = sessionInfo({ sessionId: 's1', worktreeId: 'w1', status: 'waiting' })
const working = sessionInfo({ sessionId: 's1', worktreeId: 'w1', status: 'working' })

describe('notifier', () => {
  it('notifies once per entry into waiting', async () => {
    const { n, shown } = notifier()
    n.onTransition(waiting, 'working')
    n.onTransition(waiting, 'waiting')
    n.onTransition(working, 'waiting')
    n.onTransition(waiting, 'working')
    await flush()
    expect(shown).toHaveLength(2)
  })

  it.each([
    ['focused', { focused: true }],
    ['disabled', { enabled: false }],
  ])('not when %s', async (_n, o) => {
    const { n, shown } = notifier(o)
    n.onTransition(waiting, 'working')
    await flush()
    expect(shown).toEqual([])
  })

  it('params use profile name and branch; onClickCommand targets agent-status.openSession with ids', async () => {
    const { n, shown } = notifier()
    n.onTransition(waiting, 'working')
    await flush()
    expect(shown[0]).toEqual({
      titleKey: 'agent-status:notification.waitingTitle',
      bodyKey: 'agent-status:notification.waitingBody',
      params: { agent: 'Claude Code', branch: 'feat/x' },
      onClickCommand: { id: 'agent-status.openSession', args: { worktreeId: 'w1', sessionId: 's1' } },
    })
  })

  it('open-session command selects the worktree then focuses the session', async () => {
    const commands = createCommandRegistry({ log: memoryLogger() })
    const order: [string, unknown][] = []
    commands.register('projects.selectWorktree', async (a) => void order.push(['projects.selectWorktree', a]))
    commands.register('agents.focusSession', async (a) => void order.push(['agents.focusSession', a]))
    registerOpenSessionCommand(commands)
    await commands.execute('agent-status.openSession', { worktreeId: 'w1', sessionId: 's1' })
    expect(order).toEqual([
      ['projects.selectWorktree', { worktreeId: 'w1' }],
      ['agents.focusSession', { sessionId: 's1' }],
    ])
  })

  it('default focus port reads ctx.window.isFocused()', () => {
    const isFocused = vi.fn(() => true)
    const ports = defaultNotifierPorts({
      window: { isFocused, onFocusChange: vi.fn() },
      notifications: { show: vi.fn() },
    })
    expect(ports.focus.isAppFocused()).toBe(true)
    expect(isFocused).toHaveBeenCalled()
  })
})
