import { useT } from '@pragma/sdk/renderer'
import { Icon } from '@pragma/ui/components/icon'
import { useEffect } from 'react'
import { ICONS, MARK_LARGE } from '../../constants'
import { AGENTS_TESTIDS, type AgentSession } from '../../contract'
import { useActiveWorktreeId, useAgents } from '../active-worktree'
import { NewAgentDialog } from '../launcher/NewAgentDialog'
import { ActionButton } from '../lib/buttons'
import { getRuntime } from '../runtime'
import { CloseSessionDialog } from './CloseSessionDialog'
import { SessionBody } from './SessionBody'
import { SessionTabs } from './SessionTabs'

const NO_SESSIONS: AgentSession[] = []

function EmptyAgents({ worktreeId }: { worktreeId: string }) {
  const t = useT()
  return (
    <div data-testid={AGENTS_TESTIDS.empty} className="flex flex-1 flex-col items-center justify-center gap-3 text-mu">
      <Icon name={ICONS.bot} size={MARK_LARGE} />
      <span className="text-[13px]">{t('agents:center.empty.title')}</span>
      <ActionButton onClick={() => getRuntime().store.getState().openLauncher(worktreeId)}>
        {t('agents:center.empty.action')}
      </ActionButton>
    </div>
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
        <div className="flex flex-1 items-center justify-center text-[13px] text-mu">
          {t('agents:center.noWorktree')}
        </div>
      )}
      <NewAgentDialog />
      <CloseSessionDialog />
    </div>
  )
}
