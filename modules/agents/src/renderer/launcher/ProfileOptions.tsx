import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Badge } from '@pragma/ui/components/badge'
import { type KeyboardEvent, useRef } from 'react'
import { MARK_LARGE } from '../../constants'
import { AGENTS_TESTIDS, type AgentProfile } from '../../contract'
import { PlainButton } from '../lib/buttons'
import { ProfileWarning } from '../lib/ProfileWarning'
import { ProviderMark } from '../lib/ProviderMark'
import { useProfileCheck } from '../lib/useProfileCheck'
import { commandPreview, profileName } from '../view-model'

const STEP: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }

function ProfileOption({ profile, checked, onSelect }: { profile: AgentProfile; checked: boolean; onSelect(): void }) {
  const t = useT()
  const check = useProfileCheck(profile.id)
  return (
    <PlainButton
      role="radio"
      aria-checked={checked}
      tabIndex={checked ? 0 : -1}
      data-testid={AGENTS_TESTIDS.launcherProfile}
      data-profile-id={profile.id}
      onClick={onSelect}
      className={cn(
        'flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-md border px-3 py-2.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        checked ? 'border-ac bg-ac/10' : 'border-bd hover:bg-hv',
      )}
    >
      <ProviderMark providerId={profile.providerId} size={MARK_LARGE} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-[13px] font-medium text-tx">
          {profileName(profile, t)}
          {profile.isDefault ? <Badge variant="secondary">{t('agents:settings.default')}</Badge> : null}
        </span>
        <span className="truncate font-mono text-[11.5px] text-mu">{commandPreview(profile).effective}</span>
        <ProfileWarning check={check} command={profile.command} compact />
      </span>
    </PlainButton>
  )
}

/** Radio cards of the launchable profiles; ↑/↓ move the selection. */
export function ProfileOptions({
  profiles,
  selected,
  onSelect,
}: {
  profiles: readonly AgentProfile[]
  selected: AgentProfile
  onSelect(id: string): void
}) {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  const onKeyDown = (e: KeyboardEvent) => {
    const step = STEP[e.key]
    if (!step) return
    e.preventDefault()
    const i = profiles.findIndex((p) => p.id === selected.id)
    const next = profiles[(i + step + profiles.length) % profiles.length]
    if (!next) return
    onSelect(next.id)
    ref.current?.querySelector<HTMLElement>(`[data-profile-id="${CSS.escape(next.id)}"]`)?.focus()
  }
  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={t('agents:launcher.agent')}
      tabIndex={-1}
      className="flex max-h-[260px] min-w-0 flex-col gap-1.5 overflow-y-auto"
      onKeyDown={onKeyDown}
    >
      {profiles.map((p) => (
        <ProfileOption key={p.id} profile={p} checked={p.id === selected.id} onSelect={() => onSelect(p.id)} />
      ))}
    </div>
  )
}
