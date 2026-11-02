import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@pragma/ui/components/dropdown-menu'
import { Check, ChevronDown } from '@pragma/ui/icons'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { COMMIT_BOX_MAX_ROWS, DIFF_ICON_PX, SIZE_SM } from '../../constants'
import { type ChangedFile, type StashEntry, GitChangesTestIds as T } from '../../contract'
import type { CommitOptions, ScmActions, StashKind } from './actions'
import { ErrorBanner } from './ErrorBanner'
import { commitEntries, scmMenuModel } from './menu-model'
import { ScmMenu } from './ScmMenu'
import { SyncButton } from './SyncButton'
import { useScmFeedback, useScmStore } from './scm-store'
import { useScmState } from './use-scm'

const PLAIN: CommitOptions = { amend: false, signoff: false }
const ENTER = 'Enter'
const ESCAPE = 'Escape'
const ALIGN_END = 'end'
const NEWLINE = '\n'
const rowsOf = (text: string): number => Math.min(COMMIT_BOX_MAX_ROWS, text.split(NEWLINE).length)

function CommitButton(props: {
  busy: boolean
  canCommit: boolean
  onCommit(): void
  entries: ReturnType<typeof commitEntries>
}) {
  const t = useT()
  const more = t('git-changes:scm.commit.more')
  return (
    <div className="flex min-w-0 flex-1">
      <Button
        size={SIZE_SM}
        data-testid={T.commitButton}
        disabled={props.busy || !props.canCommit}
        onClick={props.onCommit}
        className="h-7 min-w-0 flex-1 gap-1 rounded-r-none text-xs"
      >
        <Check size={DIFF_ICON_PX} aria-hidden />
        {t('git-changes:scm.commit.action')}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size={SIZE_SM}
            data-testid={T.commitMenu}
            disabled={props.busy}
            aria-label={more}
            title={more}
            className="h-7 rounded-l-none border-[var(--bg)] border-l px-1.5"
          >
            <ChevronDown size={DIFF_ICON_PX} aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={ALIGN_END}>
          {props.entries.map((entry, i) => [
            i === props.entries.length - 1 ? <DropdownMenuSeparator key={`${entry.id}-sep`} /> : null,
            <DropdownMenuItem
              key={entry.id}
              data-testid={T.commitMenuItem(entry.id)}
              disabled={entry.disabled}
              onSelect={entry.run}
            >
              {t(entry.labelKey)}
            </DropdownMenuItem>,
          ])}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/** The optional stash message (Enter stashes, Escape cancels), shown after a Stash command. */
function StashPrompt(props: { kind: StashKind; actions: ScmActions; onDone(): void }) {
  const t = useT()
  const [message, setMessage] = useState('')
  const input = useRef<HTMLInputElement>(null)
  // After the menu that opened it has closed and handed focus back to its trigger.
  useEffect(() => {
    const timer = setTimeout(() => input.current?.focus())
    return () => clearTimeout(timer)
  }, [])
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ESCAPE) props.onDone()
    if (e.key !== ENTER) return
    e.preventDefault()
    void props.actions.stashPush(props.kind, message)
    props.onDone()
  }
  return (
    <input
      ref={input}
      data-testid={T.stashPrompt}
      data-kind={props.kind}
      value={message}
      onChange={(e) => setMessage(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={t(`git-changes:scm.stash.placeholder.${props.kind}`)}
      aria-label={t(`git-changes:scm.stash.placeholder.${props.kind}`)}
      className="h-7 rounded-md border border-[var(--bd2)] bg-[var(--bg)] px-2 text-xs outline-none focus:border-[var(--ac)]"
    />
  )
}

/**
 * VS Code's Source Control header: the commit message box (⌘/Ctrl+Enter commits), the split Commit button, the
 * Sync button and the "…" menu, then the last error. `files`: the uncommitted list (staged and unstaged entries).
 */
export function ScmBar(props: {
  worktreeId: string
  files: readonly ChangedFile[]
  stashes: readonly StashEntry[]
  actions: ScmActions
}) {
  const { worktreeId, files, stashes, actions } = props
  const t = useT()
  const feedback = useScmFeedback(worktreeId)
  const state = useScmState(worktreeId)
  const [stashKind, setStashKind] = useState<StashKind | null>(null)
  const busy = feedback.running > 0
  const hasMessage = feedback.message.trim() !== ''
  const commit = async (opts: CommitOptions) => {
    const { message } = useScmStore.getState().feedback[worktreeId] ?? feedback
    const context = { message, hasStaged: files.some((f) => f.staged), hasChanges: files.length > 0 }
    if (await actions.commit(context, opts)) useScmStore.getState().setMessage(worktreeId, '')
  }
  const menu = {
    actions,
    commit: (opts: CommitOptions) => void commit(opts),
    promptStash: setStashKind,
    unstaged: files.filter((f) => !f.staged),
    stashes,
    hasHead: state?.hasHead ?? false,
  }
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== ENTER || !(e.metaKey || e.ctrlKey)) return
    e.preventDefault()
    if (hasMessage && !busy) void commit(PLAIN)
  }
  const placeholder = t('git-changes:scm.commit.placeholder', { branch: state?.branch ?? '' })
  return (
    <>
      <div className="flex shrink-0 flex-col gap-1.5 border-[var(--bd)] border-b bg-[var(--pn)] px-2 py-1.5">
        <textarea
          data-testid={T.commitMessage}
          value={feedback.message}
          rows={rowsOf(feedback.message)}
          onChange={(e) => useScmStore.getState().setMessage(worktreeId, e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-h-7 resize-none rounded-md border border-[var(--bd2)] bg-[var(--bg)] px-2 py-1 text-[13px] outline-none focus:border-[var(--ac)]"
        />
        {stashKind ? <StashPrompt kind={stashKind} actions={actions} onDone={() => setStashKind(null)} /> : null}
        <div className="flex items-center gap-1">
          <CommitButton
            busy={busy}
            canCommit={hasMessage}
            onCommit={() => void commit(PLAIN)}
            entries={commitEntries(menu)}
          />
          <SyncButton state={state} busy={busy} actions={actions} />
          <ScmMenu {...scmMenuModel(menu)} />
        </div>
      </div>
      <ErrorBanner worktreeId={worktreeId} />
    </>
  )
}
