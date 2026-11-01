import type { AgentSessionStatus } from '@pragma/module-agents/contract'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusbarCounts } from '../../src/renderer/StatusbarCounts'
import { useAgentStatusStore } from '../../src/renderer/store'
import { sessionInfo } from '../support/builders'
import { renderStatus } from '../support/render'

const seed = (statuses: AgentSessionStatus[]) => {
  for (const [i, status] of statuses.entries())
    useAgentStatusStore.getState().upsertSession(sessionInfo({ sessionId: `s${i}`, status }))
}

describe('StatusbarCounts', () => {
  it('hidden at 0/0', () => {
    seed(['idle', 'exited'])
    expect(renderStatus(<StatusbarCounts />).container.innerHTML).toBe('')
  })

  it('shows "2 working" and "1 waiting"', () => {
    seed(['working', 'working', 'waiting'])
    renderStatus(<StatusbarCounts />)
    expect(screen.getByTestId('agent-status-statusbar-working').textContent).toBe('2 working')
    expect(screen.getByTestId('agent-status-statusbar-waiting').textContent).toBe('1 waiting')
  })

  it('hides a zero item', () => {
    seed(['waiting'])
    renderStatus(<StatusbarCounts />)
    expect(screen.queryByTestId('agent-status-statusbar-working')).toBeNull()
    expect(screen.getByTestId('agent-status-statusbar-waiting')).toBeTruthy()
  })
})
