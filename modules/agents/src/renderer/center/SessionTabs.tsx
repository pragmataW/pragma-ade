import { Slot, useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@pragma/ui/components/dropdown-menu'
import { Icon } from '@pragma/ui/components/icon'
import { copyText } from '@pragma/ui/lib/clipboard'
import { LAYOUT } from '@pragma/ui/tokens'
import { ICON_SM, ICONS, MARK_TAB } from '../../constants'
import {
  AGENT_SLOTS,
  AGENTS_TESTIDS,
  type AgentSession,
  type AgentSessionTabBadgesProps,
  type AgentSessionToolbarProps,
  isRunningStatus,
  SESSION_STATUS,
} from '../../contract'
import { useAgents } from '../active-worktree'
import { IconButton, PlainButton } from '../lib/buttons'
import { ProviderMark } from '../lib/ProviderMark'
import { relaunch, requestClose, stop } from '../lib/session-actions'
import { getRuntime } from '../runtime'
import { profileName } from '../view-model'

const SELECT_KEYS = new Set(['Enter', ' '])

function SessionTab({ session, active }: { session: AgentSession; active: boolean }) {
  const t = useT()
  const profile = useAgents((s) => s.profiles.find((p) => p.id === session.profileId))
  const label = t('agents:tabs.label', { profile: profileName(profile, t), title: session.title })
  const ended = !isRunningStatus(session.status)
  const failed = session.status === SESSION_STATUS.error
  const select = () => getRuntime().store.getState().selectSession(session.worktreeId, session.id)
  return (
    <div
      role="tab"
      aria-selected={active}
      data-testid={AGENTS_TESTIDS.tab}
      data-session-id={session.id}
      data-status={session.status}
      className={cn(
        'group relative flex h-full max-w-[260px] cursor-default items-center gap-2 border-r border-bd px-3 text-[12.5px]',
        active ? 'bg-bg text-tx' : 'text-mu hover:bg-hv',
        ended && !active && 'opacity-60',
      )}
      tabIndex={active ? 0 : -1}
      onClick={select}
      onKeyDown={(e) => {
        if (SELECT_KEYS.has(e.key)) select()
      }}
    >
      {active ? <span className="absolute inset-x-0 top-0 h-[2px] bg-ac" /> : null}
      <ProviderMark providerId={session.providerId} size={MARK_TAB} />
      <span className="truncate" title={label}>
        {label}
      </span>
      {failed ? <Icon name={ICONS.failed} size={ICON_SM} className="text-err" /> : null}
      <Slot<AgentSessionTabBadgesProps> id={AGENT_SLOTS.tabBadges} props={{ session }} />
      <PlainButton
        aria-label={t('agents:tabs.close')}
        data-testid={AGENTS_TESTIDS.tabClose}
        className="rounded p-0.5 text-mu opacity-0 hover:bg-hv group-hover:opacity-100 aria-selected:opacity-100"
        onClick={(e) => {
          e.stopPropagation()
          requestClose(session)
        }}
      >
        <Icon name={ICONS.close} size={ICON_SM} />
      </PlainButton>
    </div>
  )
}

function SessionMenu({ session }: { session: AgentSession }) {
  const t = useT()
  const running = isRunningStatus(session.status)
  /** The provider's own id (what `pragma session locate` and `claude --resume` take). */
  const providerSessionId = session.externalSessionId
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton aria-label={t('agents:session.menu.label')} data-testid={AGENTS_TESTIDS.sessionMenu}>
          <Icon name={ICONS.menu} size={ICON_SM} />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={!running} onSelect={() => stop(session.id)}>
          {t('agents:session.menu.stop')}
        </DropdownMenuItem>
        <DropdownMenuItem data-testid={AGENTS_TESTIDS.sessionRestart} onSelect={() => relaunch(session.id)}>
          {t('agents:session.menu.restart')}
        </DropdownMenuItem>
        <DropdownMenuItem data-testid={AGENTS_TESTIDS.sessionClose} onSelect={() => requestClose(session)}>
          {t('agents:session.menu.close')}
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid={AGENTS_TESTIDS.sessionCopyId}
          disabled={!providerSessionId}
          title={providerSessionId ?? undefined}
          onSelect={() => {
            if (providerSessionId) void copyText(providerSessionId)
          }}
        >
          {t('agents:session.menu.copyId')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The 40px session tab strip (ui-notes "Center"): tabs, `+`, then the toolbar slot and the session menu. */
export function SessionTabs({
  worktreeId,
  sessions,
  active,
}: {
  worktreeId: string
  sessions: AgentSession[]
  active: AgentSession | undefined
}) {
  const t = useT()
  return (
    <div
      role="tablist"
      style={{ height: LAYOUT.tabStrip }}
      className="flex shrink-0 items-stretch border-b border-bd bg-pn"
    >
      <div className="flex min-w-0 items-stretch overflow-x-auto">
        {sessions.map((s) => (
          <SessionTab key={s.id} session={s} active={s.id === active?.id} />
        ))}
      </div>
      <PlainButton
        aria-label={t('agents:tabs.new')}
        data-testid={AGENTS_TESTIDS.newTab}
        className="px-2.5 text-mu hover:bg-hv hover:text-tx"
        onClick={() => getRuntime().store.getState().openLauncher(worktreeId)}
      >
        <Icon name={ICONS.add} size={ICON_SM} />
      </PlainButton>
      <div className="ml-auto flex items-center gap-1 px-2">
        {active ? (
          <>
            <Slot<AgentSessionToolbarProps> id={AGENT_SLOTS.toolbar} props={{ session: active }} />
            <SessionMenu session={active} />
          </>
        ) : null}
      </div>
    </div>
  )
}
