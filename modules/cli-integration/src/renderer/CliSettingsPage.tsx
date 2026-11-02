import { useT } from '@pragma/sdk/renderer'
import { Badge } from '@pragma/ui/components/badge'
import { Button } from '@pragma/ui/components/button'
import { Input } from '@pragma/ui/components/input'
import { type ReactNode, useState } from 'react'
import {
  CLI_INSTALL_STATE,
  CLI_TESTIDS,
  type CliInstallState,
  type CliInstallStatus,
  SKILL_STATE,
  type SkillTargetStatus,
} from '../contract'
import { SkillInstallDialog } from './SkillInstallDialog'
import { type CliIntegrationState, useCliIntegrationStatus } from './use-status'

const SMALL = 'sm'
const OUTLINE = 'outline'
const SECONDARY = 'secondary'
const MONO = '[font-family:var(--font-code)] text-[12px]'
const NOTE = 'text-[12px] text-mu'
const WARNING = 'text-[12px] text-warn'

const CLI_STATUS_KEY: Record<CliInstallState, string> = {
  [CLI_INSTALL_STATE.installed]: 'cli-integration:settings.cli.status.installed',
  [CLI_INSTALL_STATE.not_installed]: 'cli-integration:settings.cli.status.notInstalled',
  [CLI_INSTALL_STATE.conflict]: 'cli-integration:settings.cli.status.conflict',
}

function Section(p: { heading: string; description: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-[var(--bd)] pb-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-mu">{p.heading}</h3>
        <p className={NOTE}>{p.description}</p>
      </div>
      {p.children}
    </section>
  )
}

function CliStatusLine({ cli }: { cli: CliInstallStatus }) {
  const t = useT()
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px] text-tx">
      <Badge data-testid={CLI_TESTIDS.status} data-state={cli.state} variant={OUTLINE}>
        {t(CLI_STATUS_KEY[cli.state])}
      </Badge>
      <span className={MONO}>{cli.linkPath}</span>
    </div>
  )
}

function CommandLineSection({ state }: { state: CliIntegrationState & { status: { cli: CliInstallStatus } } }) {
  const t = useT()
  const { cli } = state.status
  const [dir, setDir] = useState('')
  return (
    <Section
      heading={t('cli-integration:settings.cli.heading')}
      description={t('cli-integration:settings.cli.description')}
    >
      <CliStatusLine cli={cli} />
      <div className="flex flex-col gap-1">
        <label htmlFor={CLI_TESTIDS.installDirInput} className="text-[12px] font-medium text-mu">
          {t('cli-integration:settings.cli.dirLabel')}
        </label>
        <Input
          id={CLI_TESTIDS.installDirInput}
          data-testid={CLI_TESTIDS.installDirInput}
          value={dir}
          placeholder={cli.installDir}
          onChange={(e) => setDir(e.target.value)}
          className={MONO}
        />
      </div>
      <div className="flex gap-2">
        <Button
          size={SMALL}
          data-testid={CLI_TESTIDS.installButton}
          disabled={state.busy || cli.state === CLI_INSTALL_STATE.installed}
          onClick={() => void state.installCli(dir.trim() || undefined)}
        >
          {t('cli-integration:settings.cli.install')}
        </Button>
        <Button
          size={SMALL}
          variant={SECONDARY}
          data-testid={CLI_TESTIDS.uninstallButton}
          disabled={state.busy || cli.state !== CLI_INSTALL_STATE.installed}
          onClick={() => void state.uninstallCli()}
        >
          {t('cli-integration:settings.cli.uninstall')}
        </Button>
      </div>
      {cli.dirOnPath === false ? (
        <p data-testid={CLI_TESTIDS.notOnPath} className={WARNING}>
          {t('cli-integration:settings.cli.notOnPath', { dir: cli.installDir })}
        </p>
      ) : null}
      {cli.bundleFound ? null : (
        <p data-testid={CLI_TESTIDS.bundleMissing} className={WARNING}>
          {t('cli-integration:settings.cli.bundleMissing')}
        </p>
      )}
      <p className={NOTE}>{t('cli-integration:settings.cli.agentsNote')}</p>
    </Section>
  )
}

function SkillRow({ s }: { s: SkillTargetStatus }) {
  const t = useT()
  return (
    <li
      data-testid={CLI_TESTIDS.skillRow(s.providerId, s.skillId)}
      className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 border-b border-[var(--bd)] py-2"
    >
      <span className="text-[13px] text-tx">
        {t(s.providerDisplayNameKey)} · <span className={MONO}>{s.skillId}</span>
      </span>
      <Badge data-testid={CLI_TESTIDS.skillState(s.providerId, s.skillId)} data-state={s.state} variant={OUTLINE}>
        {t(`cli-integration:settings.skills.state.${s.state}`)}
      </Badge>
      <span className="col-span-2 text-[11.5px] text-mu">
        {t(`${s.providerId}:skills.location`)}: <span className={MONO}>{s.dir}</span>
      </span>
    </li>
  )
}

function SkillsSection({ state, skills }: { state: CliIntegrationState; skills: SkillTargetStatus[] }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const anyOutdated = skills.some((s) => s.state === SKILL_STATE.outdated)
  return (
    <Section
      heading={t('cli-integration:settings.skills.heading')}
      description={t('cli-integration:settings.skills.description')}
    >
      <ul className="flex flex-col">
        {skills.map((s) => (
          <SkillRow key={s.dir} s={s} />
        ))}
      </ul>
      <div>
        <Button
          size={SMALL}
          data-testid={CLI_TESTIDS.skillsInstallButton}
          disabled={state.busy || skills.length === 0}
          onClick={() => setOpen(true)}
        >
          {t(anyOutdated ? 'cli-integration:settings.skills.update' : 'cli-integration:settings.skills.install')}
        </Button>
      </div>
      <SkillInstallDialog
        open={open}
        targets={skills}
        onCancel={() => setOpen(false)}
        onConfirm={(providerIds) => {
          setOpen(false)
          void state.installSkills(providerIds)
        }}
      />
    </Section>
  )
}

/** Settings › Command line: `pragma` on PATH and the agent skills. */
export function CliSettingsPage() {
  const t = useT()
  const state = useCliIntegrationStatus()
  const { status } = state
  return (
    <div data-testid={CLI_TESTIDS.page} className="flex max-w-[680px] flex-col gap-5">
      {status ? (
        <>
          <CommandLineSection state={{ ...state, status }} />
          <SkillsSection state={state} skills={status.skills} />
        </>
      ) : null}
      {state.error ? (
        <p data-testid={CLI_TESTIDS.error} className="text-[12px] text-err">
          {t('cli-integration:errors.generic', { message: state.error })}
        </p>
      ) : null}
    </div>
  )
}
