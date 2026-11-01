import { useT } from '@pragma/sdk/renderer'
import { Icon } from '@pragma/ui/components/icon'
import { Switch } from '@pragma/ui/components/switch'
import { type ReactNode, useState, useSyncExternalStore } from 'react'
import { ICON_SM, ICONS } from '../../constants'
import { AGENTS_TESTIDS, type AgentsSettings, agentsSettingsDefaults } from '../../contract'
import { useAgents } from '../active-worktree'
import { PlainButton } from '../lib/buttons'
import { getRuntime } from '../runtime'
import { NewProfileDialog } from './NewProfileDialog'
import { ProfileCard } from './ProfileCard'

function useAgentsSettings(): AgentsSettings {
  const { settings } = getRuntime().ctx
  return {
    ...agentsSettingsDefaults,
    ...useSyncExternalStore(
      (cb) => {
        const sub = settings.subscribe(cb)
        return () => sub.dispose()
      },
      () => settings.get(),
    ),
  }
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 font-semibold text-[11px] text-mu uppercase tracking-[0.06em]">{children}</h2>
}

function Behaviour() {
  const t = useT()
  const settings = useAgentsSettings()
  return (
    <section>
      <SectionLabel>{t('agents:settings.behaviour')}</SectionLabel>
      <div className="flex items-center justify-between rounded-lg border border-bd px-4 py-3 text-[13px]">
        <span>{t('agents:settings.confirmCloseRunning')}</span>
        <Switch
          data-testid={AGENTS_TESTIDS.confirmCloseSwitch}
          aria-label={t('agents:settings.confirmCloseRunning')}
          checked={settings.confirmCloseRunning}
          onCheckedChange={(confirmCloseRunning) =>
            void getRuntime()
              .ctx.settings.update({ confirmCloseRunning })
              .catch((e: unknown) => console.warn('agents: settings update failed', e))
          }
        />
      </div>
    </section>
  )
}

/** Settings › Agents (ui-notes 6b): profile cards, "Add custom agent", Behaviour. */
export function AgentsSettingsPage() {
  const t = useT()
  const profiles = useAgents((s) => s.profiles)
  const [adding, setAdding] = useState(false)
  return (
    <div className="flex max-w-[720px] flex-col gap-6">
      <section className="flex flex-col gap-2">
        {profiles.map((p) => (
          <ProfileCard key={p.id} profile={p} />
        ))}
        <PlainButton
          data-testid={AGENTS_TESTIDS.addCustom}
          onClick={() => setAdding(true)}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-bd py-3 text-[12.5px] text-mu hover:bg-hv hover:text-tx"
        >
          <Icon name={ICONS.add} size={ICON_SM} />
          {t('agents:settings.addCustom')}
        </PlainButton>
      </section>
      <Behaviour />
      <NewProfileDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}
