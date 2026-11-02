import { agentsErrorKey } from '@pragma/module-agents/contract'
import { useModuleSettings, useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { Input } from '@pragma/ui/components/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@pragma/ui/components/select'
import { useState } from 'react'
import { ROLE_ALERT, SIZE } from '../../constants'
import {
  type BoardSettings,
  BRANCH_CHECK_REASON,
  type StartPrep,
  BOARD_TESTIDS as T,
  type TaskDto,
} from '../../contract'
import { profileLabel } from '../lib/labels'
import { useDerivedDraft } from '../lib/use-derived-draft'
import { type StartFailure, useBranchCheck } from '../lib/use-start'
import { boardActions } from '../store'
import { SectionTitle } from './SectionTitle'

export interface StartOptions {
  profileId: string | undefined
  sendPrompt: boolean
}

/**
 * The agent picker and the "send task as first prompt" box, shared with "Start agent in this worktree". Each follows
 * its default (the default profile, the `sendPromptByDefault` setting) until the user picks a value.
 */
export function useStartOptions(prep: StartPrep | null): [StartOptions, (o: Partial<StartOptions>) => void] {
  const settings = useModuleSettings<BoardSettings>()
  const [profileId, setProfileId] = useDerivedDraft(prep?.defaultProfileId ?? undefined)
  const [sendPrompt, setSendPrompt] = useDerivedDraft(settings.sendPromptByDefault)
  const set = (o: Partial<StartOptions>) => {
    if (o.profileId !== undefined) setProfileId(o.profileId)
    if (o.sendPrompt !== undefined) setSendPrompt(o.sendPrompt)
  }
  return [{ profileId, sendPrompt }, set]
}

function BranchError({ reason }: { reason: string | null }) {
  const t = useT()
  if (!reason) return null
  return (
    <span data-testid={T.startBranchError} className="text-[11px] text-[var(--err)]">
      {t(reason === BRANCH_CHECK_REASON.exists ? 'board:start.branchExists' : 'board:start.branchInvalid')}
    </span>
  )
}

/** The failure under the Start work box; an agents error (`agents:errors.<code>|{params}`) is shown translated. */
export function StartFailureText({ failure }: { failure: StartFailure | null }) {
  const t = useT()
  if (!failure) return null
  const agentsError = agentsErrorKey(failure.message)
  const message = agentsError ? t(agentsError.key, agentsError.params) : failure.message
  return (
    <p data-testid={T.startError} role={ROLE_ALERT} className="text-[12px] text-[var(--err)]">
      {t(`board:start.error.${failure.stage}`, { message })}
    </p>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[64px_1fr] items-center gap-2 text-[12px] text-[var(--mu)]">
      <span>{label}</span>
      {children}
    </div>
  )
}

/** "Start work": branch (prefilled, checked), base, agent, send prompt → Start in new worktree with agent. */
export function StartWorkBox(props: {
  task: TaskDto
  prep: StartPrep
  options: StartOptions
  setOptions(o: Partial<StartOptions>): void
  running: boolean
  onStart(p: ReturnType<typeof boardActions.startInNewWorktree>): void
}) {
  const t = useT()
  const { task, prep, options } = props
  // Follows the suggestion (re-derived from the current title) until the user types a branch.
  const [branch, setBranch] = useDerivedDraft(prep.suggestedBranch)
  const [base, setBase] = useState(prep.defaultBaseBranch ?? prep.baseBranches[0] ?? '')
  const check = useBranchCheck(task.projectId, branch)
  const invalid = check.result !== null && !check.result.ok ? check.result.reason : null
  const blocked = props.running || check.pending || invalid !== null || !branch.trim() || prep.profiles.length === 0
  const submit = () =>
    props.onStart(
      boardActions.startInNewWorktree({
        taskId: task.id,
        branch,
        baseBranch: base || undefined,
        profileId: options.profileId,
        sendPrompt: options.sendPrompt,
      }),
    )
  return (
    <section className="flex flex-col gap-2 rounded-[var(--radius-popover)] border border-[var(--bd)] p-3">
      <SectionTitle>{t('board:start.title')}</SectionTitle>
      <Row label={t('board:start.branch')}>
        <Input
          data-testid={T.startBranch}
          value={branch}
          aria-invalid={invalid !== null}
          aria-label={t('board:start.branch')}
          onChange={(e) => setBranch(e.target.value)}
          className="font-mono text-[12px]"
        />
      </Row>
      <BranchError reason={invalid} />
      <Row label={t('board:start.base')}>
        <Select value={base} onValueChange={setBase}>
          <SelectTrigger data-testid={T.startBase} size={SIZE.sm} className="w-full font-mono text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {prep.baseBranches.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>
      <Row label={t('board:start.agent')}>
        <Select value={options.profileId ?? ''} onValueChange={(profileId) => props.setOptions({ profileId })}>
          <SelectTrigger data-testid={T.startProfile} size={SIZE.sm} className="w-full">
            <SelectValue placeholder={t('board:start.noProfiles')} />
          </SelectTrigger>
          <SelectContent>
            {prep.profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {profileLabel(t, p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>
      <label className="flex items-center gap-2 text-[12px] text-[var(--tx)]">
        <input
          type="checkbox"
          data-testid={T.startSendPrompt}
          checked={options.sendPrompt}
          onChange={(e) => props.setOptions({ sendPrompt: e.target.checked })}
          className="accent-[var(--ac)]"
        />
        {t('board:start.sendPrompt')}
      </label>
      <Button data-testid={T.startSubmit} size={SIZE.sm} disabled={blocked} onClick={submit}>
        {t(props.running ? 'board:start.running' : 'board:start.submit')}
      </Button>
    </section>
  )
}
