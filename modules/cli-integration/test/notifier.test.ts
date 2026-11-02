import { describe, expect, it } from 'vitest'
import type { CliHandoffResult } from '../src/contract'
import { createNotifier, type NotificationRequest } from '../src/main/notifier'

const result: CliHandoffResult = {
  worktree: { id: 'w2', projectId: 'p1', branch: 'handoff/x', path: '/wt', isMain: false },
  createdWorktree: true,
  session: {
    id: 's1',
    worktreeId: 'w2',
    profileId: 'oc',
    profileName: 'OpenCode',
    status: 'starting',
    title: null,
    createdAt: 1,
  },
  taskId: null,
  sourceTaskIds: [],
}
const EXPECTED: NotificationRequest = {
  titleKey: 'cli-integration:notifications.handoff.title',
  bodyKey: 'cli-integration:notifications.handoff.body',
  params: { profile: 'OpenCode', branch: 'handoff/x' },
  onClickCommand: { id: 'agents.focusSession', args: { sessionId: 's1' } },
}

describe('createNotifier', () => {
  it('shows i18n keys with profile/branch params and a focusSession click command', () => {
    const shown: NotificationRequest[] = []
    createNotifier({ show: (n) => shown.push(n) }).notifyHandoff(result)
    expect(shown).toEqual([EXPECTED])
  })

  it('records the same request when record is given', () => {
    const recorded: NotificationRequest[] = []
    createNotifier({ show: () => undefined, record: (n) => recorded.push(n) }).notifyHandoff(result)
    expect(recorded).toEqual([EXPECTED])
  })
})
