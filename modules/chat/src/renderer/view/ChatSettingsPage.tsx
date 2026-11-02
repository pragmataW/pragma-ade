import { useT } from '@pragma/sdk/renderer'
import { Input } from '@pragma/ui/components/input'
import { useId, useState } from 'react'
import { KEY_ENTER as ENTER } from '../../constants'
import { CHAT_MODES, CHAT_TESTIDS, type ChatModeName, MIN_STARTUP_TIMEOUT_MS } from '../../contract'
import { useChatHost } from '../host-adapter'
import { Segmented } from '../lib/Segmented'
import { useChatSettings } from '../lib/use-chat-settings'

const FIELD = 'flex flex-col gap-1.5'
const LABEL = 'text-[12.5px] text-tx'

function StartupTimeoutField() {
  const t = useT()
  const host = useChatHost()
  const { startupTimeoutMs } = useChatSettings()
  const [draft, setDraft] = useState<string | null>(null)
  const id = useId()
  const commit = () => {
    const value = Number(draft)
    if (draft !== null && Number.isInteger(value) && value >= MIN_STARTUP_TIMEOUT_MS)
      void host.settings.update({ startupTimeoutMs: value })
    setDraft(null)
  }
  return (
    <div className={FIELD}>
      <label htmlFor={id} className={LABEL}>
        {t('chat:settings.startupTimeout')}
      </label>
      <Input
        id={id}
        type="number"
        min={MIN_STARTUP_TIMEOUT_MS}
        className="w-40"
        data-testid={CHAT_TESTIDS.settingsStartupTimeout}
        value={draft ?? String(startupTimeoutMs)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === ENTER && commit()}
      />
    </div>
  )
}

/** Settings › Chat: default mode for new agents and the startup timeout. */
export function ChatSettingsPage() {
  const t = useT()
  const host = useChatHost()
  const { defaultMode } = useChatSettings()
  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div className={FIELD}>
        <span className={LABEL}>{t('chat:settings.defaultMode')}</span>
        <Segmented
          value={defaultMode}
          testId={CHAT_TESTIDS.settingsDefaultMode}
          onChange={(v) => void host.settings.update({ defaultMode: v as ChatModeName })}
          items={CHAT_MODES.map((mode) => ({ value: mode, label: t(`chat:launcher.${mode}`) }))}
        />
      </div>
      <StartupTimeoutField />
    </div>
  )
}
