import { aSession } from '@pragma/module-agents/testing'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusIcon } from '../../src/renderer'
import { BoardCardBadge } from '../../src/renderer/BoardCardBadge'
import { SessionTabBadge } from '../../src/renderer/SessionTabBadge'
import { useAgentStatusStore } from '../../src/renderer/store'
import { WorktreeRowStatus, WorktreeRowUnread } from '../../src/renderer/WorktreeRowBadge'
import { sessionInfo } from '../support/builders'
import { renderStatus } from '../support/render'

const row = { worktreeId: 'w1', projectId: 'p1', isActive: false }
const setWorktree = (unreadCount: number) =>
  useAgentStatusStore
    .getState()
    .upsertWorktree({ worktreeId: 'w1', status: 'waiting', turnCompleted: false, unreadCount, sessionCount: 2 })

describe('badges', () => {
  it('worktree badge hidden without sessions', () => {
    const { container } = renderStatus(
      <>
        <WorktreeRowStatus {...row} />
        <WorktreeRowUnread {...row} />
      </>,
    )
    expect(container.innerHTML).toBe('')
  })

  it('waiting icon + unread pill 2', () => {
    setWorktree(2)
    renderStatus(
      <>
        <WorktreeRowStatus {...row} />
        <WorktreeRowUnread {...row} />
      </>,
    )
    expect(screen.getByTestId('agent-status-worktree-badge').getAttribute('data-status')).toBe('waiting')
    const pill = screen.getByTestId('agent-status-unread')
    expect(pill.querySelector('[aria-hidden]')?.textContent).toBe('2')
    expect(screen.getByText('2 unread updates')).toBeTruthy()
  })

  it('tab badge reads props.session, then the live status with detail', () => {
    const session = aSession('s1', 1, { status: 'starting' })
    const { rerender } = renderStatus(<SessionTabBadge session={session} />)
    expect(screen.getByTestId('agent-status-icon').getAttribute('data-status')).toBe('starting')
    useAgentStatusStore.getState().upsertSession(sessionInfo({ sessionId: 's1', status: 'working', detail: 'Bash' }))
    rerender(<SessionTabBadge session={session} />)
    expect(screen.getByTestId('agent-status-tab-badge').getAttribute('title')).toBe('Working · Bash')
  })

  it('card badge summarizes given sessionIds and hides when none known', () => {
    const { container, rerender } = renderStatus(<BoardCardBadge taskId={1} sessionIds={['x']} />)
    expect(container.innerHTML).toBe('')
    const s = useAgentStatusStore.getState()
    s.upsertSession(sessionInfo({ sessionId: 'a', status: 'idle', turnCompleted: true }))
    s.upsertSession(sessionInfo({ sessionId: 'b', status: 'error' }))
    rerender(<BoardCardBadge taskId={1} sessionIds={['a', 'b', 'x']} />)
    expect(screen.getByTestId('agent-status-icon').getAttribute('data-status')).toBe('error')
  })

  it('icon aria-label from i18n + data attributes; renderer entry named-exports StatusIcon', () => {
    renderStatus(<StatusIcon status="idle" turnCompleted />)
    const icon = screen.getByRole('img')
    expect(icon.getAttribute('aria-label')).toBe('Done')
    expect(icon.getAttribute('data-visual')).toBe('done')
  })
})
