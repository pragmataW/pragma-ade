import type { AgentSessionToolbarProps } from '@pragma/module-agents/contract'
import { useT } from '@pragma/sdk/renderer'
import { ToggleGroup, ToggleGroupItem } from '@pragma/ui/components/toggle-group'
import { Loader2 } from '@pragma/ui/icons'
import { CONFIRM_STATUSES, SPINNER_PX, TOGGLE_VARIANT } from '../constants'
import { SWITCH_PHASE, SWITCH_TARGET, SWITCH_TARGETS, type SwitchTarget, CHAT_SWITCH_TESTIDS as T } from '../contract'
import { useSwitchClient } from './switch-client'
import { useSwitchState } from './use-switch-state'

const TESTID: Record<SwitchTarget, string> = { chat: T.toChat, terminal: T.toTerminal }
const CONFIRM: Record<SwitchTarget, { titleKey: string; messageKey: string; confirmKey: string }> = {
  chat: {
    titleKey: 'chat-switch:confirm.toChat.title',
    messageKey: 'chat-switch:confirm.toChat.body',
    confirmKey: 'chat-switch:confirm.toChat.action',
  },
  terminal: {
    titleKey: 'chat-switch:confirm.toTerminal.title',
    messageKey: 'chat-switch:confirm.toTerminal.body',
    confirmKey: 'chat-switch:confirm.toTerminal.action',
  },
}

/** Always before → chat (the terminal process stops); before → terminal only while a turn runs. */
const needsConfirm = (target: SwitchTarget, status: string): boolean =>
  target === SWITCH_TARGET.chat || CONFIRM_STATUSES.has(status)

/** ui-notes "Center": the compact Chat | Terminal segmented toggle of an agent session. */
export function ViewToggle({ session }: AgentSessionToolbarProps) {
  const t = useT()
  const client = useSwitchClient()
  const state = useSwitchState(session.id, `${session.mode}|${session.status}|${session.externalSessionId}`)
  const switching = state.phase === SWITCH_PHASE.switching
  const onChange = async (value: string) => {
    const target = SWITCH_TARGETS.find((x) => x === value)
    if (!target || target === session.mode) return
    if (needsConfirm(target, session.status) && !(await client.confirm(CONFIRM[target]))) return
    await state.switchTo(target)
  }
  return (
    <div className="relative flex items-center gap-1">
      {switching ? (
        <span
          data-testid={T.spinner}
          role="status"
          aria-label={t('chat-switch:toggle.switching')}
          title={t('chat-switch:toggle.switching')}
        >
          <Loader2 size={SPINNER_PX} className="animate-spin text-mu" aria-hidden />
        </span>
      ) : null}
      <ToggleGroup
        type="single"
        variant={TOGGLE_VARIANT}
        className="w-fit"
        value={session.mode}
        aria-label={t('chat-switch:toggle.label')}
        data-testid={T.toggle}
        data-phase={state.phase}
        onValueChange={(v: string) => void onChange(v)}
      >
        {SWITCH_TARGETS.map((target) => {
          const verdict = state.eligibility?.[target]
          const current = target === session.mode
          const blocked = !current && (switching || !verdict?.ok)
          const reason = !current && verdict && !verdict.ok ? t(verdict.reasonKey) : undefined
          return (
            <span key={target} title={reason} className="inline-flex">
              <ToggleGroupItem
                value={target}
                disabled={blocked || (switching && current)}
                data-testid={TESTID[target]}
                data-reason={verdict && !verdict.ok ? verdict.reasonKey : undefined}
                className="h-6 px-2 text-[12px]"
              >
                {t(`chat-switch:toggle.${target}`)}
              </ToggleGroupItem>
            </span>
          )
        })}
      </ToggleGroup>
      {state.alertKey ? (
        <div
          role="alert"
          data-testid={T.alert}
          className="absolute top-full right-0 z-50 mt-1 w-64 rounded-md border border-bd bg-el px-2.5 py-1.5 text-[12px] text-warn shadow-lg"
        >
          {t(state.alertKey)}
        </div>
      ) : null}
    </div>
  )
}
