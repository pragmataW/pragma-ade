import { useT } from '@pragma/sdk/renderer'
import { EmptyState } from '@pragma/ui'
import { useEffect } from 'react'
import { ICONS } from '../../constants'
import { AGENTS_TESTIDS, type AgentSession } from '../../contract'
import { useActiveWorktreeId, useAgents } from '../active-worktree'
import { NewAgentDialog } from '../launcher/NewAgentDialog'
import { getRuntime } from '../runtime'
import { CloseSessionDialog } from './CloseSessionDialog'
import { SessionBody } from './SessionBody'
import { SessionTabs } from './SessionTabs'

const NO_SESSIONS: AgentSession[] = []

function EmptyAgents({ worktreeId }: { worktreeId: string }) {
  const t = useT()
  return (
    <EmptyState
      testId={AGENTS_TESTIDS.empty}
      icon={ICONS.bot}
      title={t('agents:center.empty.title')}
      description={t('agents:center.empty.hint')}
      primaryAction={{
        label: t('agents:center.empty.action'),
        icon: ICONS.add,
        onClick: () => getRuntime().store.getState().openLauncher(worktreeId),
      }}
    />
  )
}

function WorktreeSessions({ worktreeId }: { worktreeId: string }) {
  const loaded = useAgents((s) => s.sessions[worktreeId] !== undefined)
  const sessions = useAgents((s) => s.sessions[worktreeId] ?? NO_SESSIONS)
  const activeId = useAgents((s) => s.activeSessionId[worktreeId] ?? null)
  useEffect(() => {
    if (!loaded)
      getRuntime()
        .store.getState()
        .loadSessions(worktreeId)
        .catch((e: unknown) => console.warn(e))
  }, [loaded, worktreeId])
  if (sessions.length === 0) return <EmptyAgents worktreeId={worktreeId} />
  const active = sessions.find((s) => s.id === activeId) ?? sessions.at(-1)
  return (
    <>
      <SessionTabs worktreeId={worktreeId} sessions={sessions} active={active} />
      {active ? <SessionBody key={active.id} session={active} /> : null}
    </>
  )
}

/** The `agents` center view: the active worktree's agent sessions as tabs. */
export function AgentsCenterView() {
  const t = useT()
  const worktreeId = useActiveWorktreeId()
  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      {worktreeId ? (
        <WorktreeSessions key={worktreeId} worktreeId={worktreeId} />
      ) : (
        <EmptyState
          icon={ICONS.noWorktree}
          title={t('agents:center.noWorktreeTitle')}
          description={t('agents:center.noWorktree')}
        />
      )}
      <NewAgentDialog />
      <CloseSessionDialog />
    </div>
  )
}
