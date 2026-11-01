import { projectsCommands } from '@pragma/module-projects/contract'
import { CoreCommands, slugify } from '@pragma/sdk'
import { Slot, useLatestAsync, useT } from '@pragma/sdk/renderer'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@pragma/ui/components/dialog'
import { Input } from '@pragma/ui/components/input'
import { ToggleGroup, ToggleGroupItem } from '@pragma/ui/components/toggle-group'
import { type KeyboardEvent, useState } from 'react'
import { BRANCH_PREFIX, BRANCH_SLUG_MAX } from '../../constants'
import {
  AGENT_SLOTS,
  AGENTS_MODULE_ID,
  AGENTS_TESTIDS,
  type AgentLauncherOptionsProps,
  type AgentProfile,
  agentsIpc,
  type LauncherOptions,
  launcherOptionsSchema,
  type StartSessionInput,
  TERMINAL_MODE,
} from '../../contract'
import { useActiveWorktreeId, useAgents } from '../active-worktree'
import { ActionButton, QuietButton } from '../lib/buttons'
import { ErrorLine } from '../lib/ErrorLine'
import { useAgentsErrorText } from '../lib/useAgentsErrorText'
import { getRuntime } from '../runtime'
import { launchableProfiles, profileName } from '../view-model'
import { ProfileOptions } from './ProfileOptions'

const RUN_IN = { current: 'current', newWorktree: 'newWorktree' } as const
type RunIn = (typeof RUN_IN)[keyof typeof RUN_IN]
const ENTER = 'Enter'
const BRANCH_FIELD_ID = 'agents-launcher-branch-field'
const NEWLINE = '\n'
const FIELD_LABEL = 'text-[12px] font-medium text-mu'
const RUN_IN_ITEM = 'px-3 text-[12.5px]'
const TEXTAREA_CLASS =
  'min-h-[84px] w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30'

const closeLauncher = () => getRuntime().store.getState().closeLauncher()

function suggestedBranch(prompt: string, profile: AgentProfile | undefined, t: (k: string) => string): string {
  const firstLine = prompt.split(NEWLINE)[0]?.trim() ?? ''
  return BRANCH_PREFIX + slugify(firstLine || profileName(profile, t), { maxLength: BRANCH_SLUG_MAX })
}

/** "New worktree from {{base}}": the base comes from main (`agents.newWorktreeDefaults`). */
function useBaseBranch(worktreeId: string | null): string | null {
  const { ipc } = getRuntime().ctx
  const defaults = useLatestAsync(
    async () => (worktreeId ? ipc.invoke(agentsIpc.newWorktreeDefaults, { worktreeId }) : null),
    [ipc, worktreeId],
  )
  return defaults.data?.baseBranch ?? null
}

interface LaunchForm {
  worktreeId: string
  profile: AgentProfile
  prompt: string
  options: LauncherOptions
  newWorktree?: { branch: string; baseBranch: string }
}

async function startSession(form: LaunchForm): Promise<void> {
  const { ctx, store } = getRuntime()
  const input: StartSessionInput = {
    worktreeId: form.worktreeId,
    profileId: form.profile.id,
    initialPrompt: form.prompt.trim() === '' ? undefined : form.prompt,
    mode: form.options.mode,
  }
  if (form.newWorktree) input.newWorktree = form.newWorktree
  const session = await ctx.ipc.invoke(agentsIpc.startSession, input)
  store.getState().closeLauncher()
  store.getState().applySessionChanged({ session, reveal: true })
  if (form.newWorktree)
    await ctx.commands.execute(projectsCommands.selectWorktree.id, { worktreeId: session.worktreeId })
}

function RunInField(props: {
  runIn: RunIn
  setRunIn(v: RunIn): void
  base: string | null
  branch: string
  setBranch(v: string): void
}) {
  const t = useT()
  return (
    <div className="flex flex-col gap-1.5">
      <span className={FIELD_LABEL}>{t('agents:launcher.runIn.label')}</span>
      <ToggleGroup
        type="single"
        variant="outline"
        data-testid={AGENTS_TESTIDS.launcherRunIn}
        value={props.runIn}
        onValueChange={(v) => v && props.setRunIn(v as RunIn)}
      >
        <ToggleGroupItem value={RUN_IN.current} className={RUN_IN_ITEM}>
          {t('agents:launcher.runIn.current')}
        </ToggleGroupItem>
        <ToggleGroupItem
          value={RUN_IN.newWorktree}
          data-testid={AGENTS_TESTIDS.launcherNewWorktree}
          disabled={!props.base}
          className={RUN_IN_ITEM}
        >
          {t('agents:launcher.runIn.newWorktree', { base: props.base ?? '' })}
        </ToggleGroupItem>
      </ToggleGroup>
      {props.runIn === RUN_IN.newWorktree ? (
        <div className="mt-1 flex flex-col gap-1">
          <label htmlFor={BRANCH_FIELD_ID} className={FIELD_LABEL}>
            {t('agents:launcher.branch')}
          </label>
          <Input
            id={BRANCH_FIELD_ID}
            data-testid={AGENTS_TESTIDS.launcherBranch}
            value={props.branch}
            onChange={(e) => props.setBranch(e.target.value)}
            className="[font-family:var(--font-code)] text-[12px]"
          />
        </div>
      ) : null}
    </div>
  )
}

function LauncherFooter({ canStart, start }: { canStart: boolean; start(): void }) {
  const t = useT()
  return (
    <DialogFooter className="items-center sm:justify-between">
      <QuietButton
        data-testid={AGENTS_TESTIDS.launcherConfigure}
        onClick={() => {
          closeLauncher()
          void getRuntime().ctx.commands.execute(CoreCommands.openSettings, { pageId: AGENTS_MODULE_ID })
        }}
      >
        {t('agents:launcher.configure')}
      </QuietButton>
      <div className="flex gap-2">
        <QuietButton onClick={closeLauncher}>{t('agents:launcher.cancel')}</QuietButton>
        <ActionButton data-testid={AGENTS_TESTIDS.launcherStart} disabled={!canStart} onClick={start}>
          {t('agents:launcher.start')}
          <kbd className="ml-1 text-[11px] opacity-70">⌘↵</kbd>
        </ActionButton>
      </div>
    </DialogFooter>
  )
}

function LauncherForm({ worktreeId }: { worktreeId: string | null }) {
  const t = useT()
  const errorText = useAgentsErrorText()
  const profiles = launchableProfiles(useAgents((s) => s.profiles))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const profile = profiles.find((p) => p.id === selectedId) ?? profiles[0]
  const [prompt, setPrompt] = useState('')
  const [runIn, setRunIn] = useState<RunIn>(RUN_IN.current)
  const [editedBranch, setEditedBranch] = useState<string | null>(null)
  const [options, setOptions] = useState<LauncherOptions>(() => launcherOptionsSchema.parse({ mode: TERMINAL_MODE }))
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const base = useBaseBranch(worktreeId)
  const branch = editedBranch ?? suggestedBranch(prompt, profile, t)
  const inNewWorktree = runIn === RUN_IN.newWorktree
  const canStart =
    !pending && profile !== undefined && worktreeId !== null && (!inNewWorktree || (branch.trim() !== '' && !!base))

  const start = async () => {
    if (!canStart || !profile || !worktreeId) return
    setPending(true)
    setError(null)
    try {
      await startSession({
        worktreeId,
        profile,
        prompt,
        options,
        newWorktree: inNewWorktree && base ? { branch: branch.trim(), baseBranch: base } : undefined,
      })
    } catch (e) {
      setError(errorText(e))
      setPending(false)
    }
  }
  const onDialogKeyDown = (e: KeyboardEvent) => {
    if (e.key !== ENTER || !(e.metaKey || e.ctrlKey)) return
    e.preventDefault()
    void start()
  }
  const onPromptKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== ENTER || e.shiftKey || e.metaKey || e.ctrlKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    void start()
  }
  const slotProps: AgentLauncherOptionsProps = {
    worktreeId: worktreeId ?? '',
    profile: profile ?? null,
    options,
    setOptions: (patch) => setOptions((o) => ({ ...o, ...patch })),
  }
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: ⌘/Ctrl+Enter starts from anywhere in the dialog
    <div className="flex flex-col gap-4" onKeyDown={onDialogKeyDown}>
      <div className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>{t('agents:launcher.agent')}</span>
        {profile ? (
          <ProfileOptions profiles={profiles} selected={profile} onSelect={setSelectedId} />
        ) : (
          <div className="rounded-md border border-bd px-3 py-4 text-[12.5px] text-mu">
            {t('agents:launcher.noProfiles')}
          </div>
        )}
      </div>
      <RunInField runIn={runIn} setRunIn={setRunIn} base={base} branch={branch} setBranch={setEditedBranch} />
      <label className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>{t('agents:launcher.promptLabel')}</span>
        <textarea
          data-testid={AGENTS_TESTIDS.launcherPrompt}
          className={TEXTAREA_CLASS}
          placeholder={t('agents:launcher.promptPlaceholder')}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onPromptKeyDown}
        />
      </label>
      <Slot<AgentLauncherOptionsProps> id={AGENT_SLOTS.launcherOptions} props={slotProps} />
      <ErrorLine text={error} testId={AGENTS_TESTIDS.launcherError} />
      <LauncherFooter canStart={canStart} start={() => void start()} />
    </div>
  )
}

/** The ui-notes 6a "New agent" dialog, driven by `store.launcher`. */
export function NewAgentDialog() {
  const t = useT()
  const launcher = useAgents((s) => s.launcher)
  const activeWorktreeId = useActiveWorktreeId()
  return (
    <Dialog open={launcher.open} onOpenChange={(open) => (open ? undefined : closeLauncher())}>
      {launcher.open ? (
        <DialogContent data-testid={AGENTS_TESTIDS.launcher} aria-describedby={undefined} className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>{t('agents:launcher.title')}</DialogTitle>
          </DialogHeader>
          <LauncherForm worktreeId={launcher.worktreeId ?? activeWorktreeId} />
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
