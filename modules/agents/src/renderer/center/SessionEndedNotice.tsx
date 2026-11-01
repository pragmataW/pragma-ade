import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Icon } from '@pragma/ui/components/icon'
import { ICON_SM, ICONS } from '../../constants'
import { AGENTS_TESTIDS, type AgentSession, SESSION_STATUS } from '../../contract'
import { ActionButton, QuietButton } from '../lib/buttons'
import { relaunch, requestClose } from '../lib/session-actions'
import { useAgentsErrorText } from '../lib/useAgentsErrorText'

function useNoticeText(session: AgentSession): { title: string; detail: string | null } {
  const t = useT()
  const errorText = useAgentsErrorText()
  if (session.status === SESSION_STATUS.error)
    return { title: t('agents:session.failed.title'), detail: errorText(session.error?.message ?? '') }
  const detail = session.exitCode === null ? null : t('agents:session.ended.exitCode', { code: session.exitCode })
  return { title: t('agents:session.ended.title'), detail }
}

/** Ended/failed session: a full placeholder (no terminal to show) or a banner above the exited terminal. */
export function SessionEndedNotice({ session, variant }: { session: AgentSession; variant: 'placeholder' | 'banner' }) {
  const t = useT()
  const { title, detail } = useNoticeText(session)
  const failed = session.status === SESSION_STATUS.error
  return (
    <div
      data-testid={failed ? AGENTS_TESTIDS.sessionError : AGENTS_TESTIDS.sessionEnded}
      className={cn(
        'flex gap-3 text-[12.5px]',
        variant === 'placeholder'
          ? 'h-full flex-col items-center justify-center text-mu'
          : 'items-center border-b border-bd bg-pn px-3 py-1.5',
      )}
    >
      <Icon name={failed ? ICONS.failed : ICONS.ended} size={ICON_SM} className={failed ? 'text-err' : 'text-mu'} />
      <span className="text-tx">{title}</span>
      {detail ? <span className="font-mono text-[12px]">{detail}</span> : null}
      <div className="flex gap-2">
        <ActionButton onClick={() => relaunch(session.id)}>{t('agents:session.ended.restart')}</ActionButton>
        <QuietButton onClick={() => requestClose(session)}>{t('agents:session.ended.close')}</QuietButton>
      </div>
    </div>
  )
}
