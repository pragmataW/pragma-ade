import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Badge } from '@pragma/ui/components/badge'
import { Icon } from '@pragma/ui/components/icon'
import { Switch } from '@pragma/ui/components/switch'
import { useState } from 'react'
import { ICON_SM, ICONS, MARK_LARGE } from '../../constants'
import { AGENTS_TESTIDS, type AgentProfile, agentsIpc, RESOLUTION, type UpdateProfilePatch } from '../../contract'
import { useAgents } from '../active-worktree'
import { ActionButton, IconButton, QuietButton } from '../lib/buttons'
import { ErrorLine } from '../lib/ErrorLine'
import { ProfileWarning } from '../lib/ProfileWarning'
import { ProviderMark } from '../lib/ProviderMark'
import { refreshCheck, useProfileCheck } from '../lib/useProfileCheck'
import { commandPreview, profileName } from '../view-model'
import { EnvEditor } from './EnvEditor'
import { ArgsField, CommandField } from './ProfileFields'
import { type RunProfileAction, useProfileAction } from './profile-action'

const SECONDARY = 'secondary'
const OUTLINE = 'outline'
const MONO = '[font-family:var(--font-code)]'
const FIELD_LABEL = 'text-[12px] font-medium text-mu'

function Badges({ profile }: { profile: AgentProfile }) {
  const t = useT()
  return (
    <>
      {profile.isDefault ? <Badge variant={SECONDARY}>{t('agents:settings.default')}</Badge> : null}
      {profile.enabled ? null : <Badge variant={OUTLINE}>{t('agents:settings.disabled')}</Badge>}
      {profile.available ? null : <Badge variant={OUTLINE}>{t('agents:settings.unavailable')}</Badge>}
    </>
  )
}

/** The struck stock command line next to the effective one for a customized built-in. */
function PreviewLine({ profile }: { profile: AgentProfile }) {
  const preview = commandPreview(profile)
  return (
    <span className={cn('flex min-w-0 items-center gap-2 truncate text-[11.5px] text-mu', MONO)}>
      {preview.customized && preview.stock !== null ? (
        <s data-testid={AGENTS_TESTIDS.previewStock} className="opacity-70">
          {preview.stock}
        </s>
      ) : null}
      <span data-testid={AGENTS_TESTIDS.previewEffective} className="truncate">
        {preview.effective}
      </span>
    </span>
  )
}

/** Test launch → `agents.checkProfile`; the found path (and version) of the last test. */
function TestLaunch({ profile }: { profile: AgentProfile }) {
  const t = useT()
  const [tested, setTested] = useState(false)
  const check = useAgents((s) => s.checks[profile.id])
  const test = () => {
    setTested(true)
    refreshCheck(profile.id)
  }
  const r = check?.resolution
  const version = check?.compatibility?.ok ? check.compatibility.version : undefined
  return (
    <div className="flex items-center gap-3">
      <ActionButton data-testid={AGENTS_TESTIDS.testLaunch} variant={OUTLINE} onClick={test}>
        {t('agents:settings.check')}
      </ActionButton>
      {tested && r?.status === RESOLUTION.found ? (
        <span data-testid={AGENTS_TESTIDS.checkResult} className="flex items-center gap-1.5 text-[12px] text-ok">
          <Icon name={ICONS.check} size={ICON_SM} />
          {version
            ? t('agents:settings.foundVersion', { path: r.path, version })
            : t('agents:settings.found', { path: r.path })}
        </span>
      ) : null}
    </div>
  )
}

function ProfileDetails({ profile, run }: { profile: AgentProfile; run: RunProfileAction }) {
  const t = useT()
  const update = (patch: UpdateProfilePatch) => void run(agentsIpc.updateProfile, { id: profile.id, patch })
  const preview = commandPreview(profile)
  return (
    <div className="flex flex-col gap-3 border-t border-bd px-4 py-3">
      <div className="grid grid-cols-2 gap-3">
        <CommandField profile={profile} onSave={(command) => update({ command })} />
        <ArgsField profile={profile} onSave={(args) => update({ args })} />
      </div>
      <div className="flex flex-col gap-1">
        <span className={FIELD_LABEL}>{t('agents:settings.environment')}</span>
        <EnvEditor env={profile.env} onSave={(env) => update({ env })} />
      </div>
      <code className={cn('rounded-md bg-hv px-2 py-1.5 text-[12px] text-tx', MONO)}>$ {preview.effective}</code>
      <div className="flex items-center justify-between gap-3">
        <TestLaunch profile={profile} />
        <div className="flex gap-2">
          {profile.isBuiltin && preview.customized ? (
            <QuietButton
              data-testid={AGENTS_TESTIDS.reset}
              onClick={() => void run(agentsIpc.resetProfile, { id: profile.id })}
            >
              {t('agents:settings.reset', { command: profile.stockCommand ?? '' })}
            </QuietButton>
          ) : null}
          {profile.isBuiltin ? null : (
            <QuietButton
              data-testid={AGENTS_TESTIDS.deleteProfile}
              className="text-err"
              onClick={() => void run(agentsIpc.deleteProfile, { id: profile.id })}
            >
              {t('agents:settings.delete')}
            </QuietButton>
          )}
        </div>
      </div>
    </div>
  )
}

function CardControls({ profile, run }: { profile: AgentProfile; run: RunProfileAction }) {
  const t = useT()
  const canSetDefault = profile.enabled && profile.available && !profile.isDefault
  return (
    <>
      {canSetDefault ? (
        <QuietButton
          data-testid={AGENTS_TESTIDS.setDefault}
          onClick={() => void run(agentsIpc.setDefaultProfile, { id: profile.id })}
        >
          {t('agents:settings.setDefault')}
        </QuietButton>
      ) : null}
      <span title={profile.isDefault ? t('agents:settings.defaultCannotDisable') : undefined}>
        <Switch
          data-testid={AGENTS_TESTIDS.enabledSwitch}
          aria-label={t('agents:settings.enabled')}
          checked={profile.enabled}
          disabled={profile.isDefault}
          onCheckedChange={(enabled) => void run(agentsIpc.updateProfile, { id: profile.id, patch: { enabled } })}
        />
      </span>
    </>
  )
}

/** One profile in Settings › Agents (ui-notes 6b): collapsed summary, expandable editor. */
export function ProfileCard({ profile }: { profile: AgentProfile }) {
  const t = useT()
  const [expanded, setExpanded] = useState(false)
  const check = useProfileCheck(profile.id)
  const { run, error } = useProfileAction()
  return (
    <div
      data-testid={AGENTS_TESTIDS.profileCard}
      data-profile-id={profile.id}
      className="rounded-lg border border-bd bg-bg"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <ProviderMark providerId={profile.providerId} size={MARK_LARGE} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2 text-[13px] font-medium text-tx">
            {profileName(profile, t)}
            <Badges profile={profile} />
          </span>
          <PreviewLine profile={profile} />
          <ProfileWarning check={check} command={profile.command} />
        </div>
        <CardControls profile={profile} run={run} />
        <IconButton
          data-testid={AGENTS_TESTIDS.profileExpand}
          aria-label={t('agents:settings.expand')}
          aria-expanded={expanded}
          onClick={() => setExpanded((x) => !x)}
        >
          <Icon name={expanded ? ICONS.collapse : ICONS.expand} size={ICON_SM} />
        </IconButton>
      </div>
      <ErrorLine text={error} className="px-4 pb-2" />
      {expanded ? <ProfileDetails profile={profile} run={run} /> : null}
    </div>
  )
}
