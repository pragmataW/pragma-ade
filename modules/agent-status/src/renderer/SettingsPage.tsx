import { useModuleSettings, useRendererContext, useT } from '@pragma/sdk/renderer'
import { Input } from '@pragma/ui/components/input'
import { Switch } from '@pragma/ui/components/switch'
import type { ReactNode } from 'react'
import { IDLE_SECONDS_MAX, IDLE_SECONDS_MIN, MS_PER_SECOND } from '../constants'
import { type AgentStatusSettings, AGENT_STATUS_TEST_IDS as T } from '../contract'

const IDLE_INPUT_ID = 'agent-status-idle-seconds'

export const clampIdleSeconds = (raw: string): number => {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return IDLE_SECONDS_MIN
  return Math.min(IDLE_SECONDS_MAX, Math.max(IDLE_SECONDS_MIN, n))
}

function Row({ label, hint, children }: { label: ReactNode; hint: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-bd px-4 py-3 text-[13px]">
      <span className="flex flex-col gap-0.5">
        {label}
        <span className="text-[12px] text-mu">{hint}</span>
      </span>
      {children}
    </div>
  )
}

const SECTION_LABEL = 'mb-2 font-semibold text-[11px] text-mu uppercase tracking-[0.06em]'

/** Settings › Notifications: the waiting notification switch and the activity-fallback idle time. */
export function AgentStatusSettingsPage() {
  const t = useT()
  const ctx = useRendererContext<AgentStatusSettings>()
  const settings = useModuleSettings<AgentStatusSettings>()
  const update = (patch: Parameters<typeof ctx.settings.update>[0]) =>
    void ctx.settings.update(patch).catch((e: unknown) => console.warn('agent-status: settings update failed', e))
  return (
    <div className="flex max-w-[720px] flex-col gap-6">
      <section>
        <Row
          label={t('agent-status:settings.notifications.label')}
          hint={t('agent-status:settings.notifications.hint')}
        >
          <Switch
            data-testid={T.settingsNotifications}
            aria-label={t('agent-status:settings.notifications.label')}
            checked={settings.notifications.enabled}
            onCheckedChange={(enabled) => update({ notifications: { enabled } })}
          />
        </Row>
      </section>
      <section>
        <h2 className={SECTION_LABEL}>{t('agent-status:settings.fallback.section')}</h2>
        <Row
          label={<label htmlFor={IDLE_INPUT_ID}>{t('agent-status:settings.fallback.label')}</label>}
          hint={t('agent-status:settings.fallback.hint')}
        >
          <Input
            id={IDLE_INPUT_ID}
            data-testid={T.settingsIdleSeconds}
            type="number"
            min={IDLE_SECONDS_MIN}
            max={IDLE_SECONDS_MAX}
            className="w-20"
            defaultValue={Math.round(settings.fallback.activityIdleMs / MS_PER_SECOND)}
            onBlur={(e) => {
              const seconds = clampIdleSeconds(e.target.value)
              e.target.value = String(seconds)
              update({ fallback: { activityIdleMs: seconds * MS_PER_SECOND } })
            }}
          />
        </Row>
      </section>
    </div>
  )
}
