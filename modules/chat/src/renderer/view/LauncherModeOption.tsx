import { type AgentLauncherOptionsProps, TERMINAL_MODE } from '@pragma/module-agents/contract'
import { useT } from '@pragma/sdk/renderer'
import { useEffect } from 'react'
import { CHAT_MODE, CHAT_TESTIDS } from '../../contract'
import { Segmented } from '../lib/Segmented'
import { useChatSettings } from '../lib/use-chat-settings'
import { useLatest } from '../lib/use-latest'
import { useChatSupport } from './use-chat-support'

const LABEL = 'text-[11px] font-semibold uppercase tracking-[0.06em] text-mu'

/** New agent dialog (03): Chat | Terminal; Chat is disabled with the reason when the profile cannot chat. */
export function LauncherModeOption({ profile, options, setOptions }: AgentLauncherOptionsProps) {
  const t = useT()
  const { defaultMode } = useChatSettings()
  const support = useChatSupport(profile?.id ?? null)
  const set = useLatest(setOptions)
  useEffect(() => {
    if (support) set.current({ mode: support.ok ? defaultMode : TERMINAL_MODE })
  }, [support, defaultMode, set])
  const reason = support && !support.ok ? t('chat:launcher.unsupported', { reason: t(support.reasonKey) }) : undefined
  return (
    <div className="flex flex-col gap-1.5">
      <span className={LABEL}>{t('chat:launcher.mode')}</span>
      <Segmented
        value={options.mode}
        onChange={(mode) => setOptions({ mode })}
        items={[
          {
            value: CHAT_MODE,
            label: t('chat:launcher.chat'),
            disabled: reason !== undefined,
            title: reason,
            testId: CHAT_TESTIDS.launcherMode(CHAT_MODE),
          },
          {
            value: TERMINAL_MODE,
            label: t('chat:launcher.terminal'),
            testId: CHAT_TESTIDS.launcherMode(TERMINAL_MODE),
          },
        ]}
      />
      {reason ? (
        <span data-testid={CHAT_TESTIDS.launcherUnsupported} className="text-[11.5px] text-mu">
          {reason}
        </span>
      ) : null}
    </div>
  )
}
