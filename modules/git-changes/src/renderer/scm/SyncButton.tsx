import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Button } from '@pragma/ui/components/button'
import { CloudUpload, RefreshCw } from '@pragma/ui/icons'
import { DIFF_ICON_PX, SIZE_SM, VARIANT_OUTLINE } from '../../constants'
import { REMOTE_ACTIONS, type ScmState, GitChangesTestIds as T } from '../../contract'
import type { ScmActions } from './actions'

const [, , , PUSH, SYNC] = REMOTE_ACTIONS
type Translate = ReturnType<typeof useT>

/** Something to send or get: a branch to publish, or commits ahead / behind its upstream. */
export const hasPendingSync = (state: ScmState | undefined): boolean =>
  !!state?.branch && (state.upstream === null ? state.hasRemote : state.ahead + state.behind > 0)

/** Tooltip and visible text: "Publish Branch", or `behind↓ ahead↑` ("Sync Changes …" on the primary button). */
function syncTexts(t: Translate, state: ScmState & { branch: string }, primary: boolean) {
  if (state.upstream === null)
    return {
      title: t('git-changes:scm.sync.publishTitle', { branch: state.branch }),
      label: t('git-changes:scm.sync.publish'),
    }
  const counts = t('git-changes:scm.sync.counts', { ahead: state.ahead, behind: state.behind })
  return {
    title: t('git-changes:scm.sync.title', { upstream: state.upstream, ahead: state.ahead, behind: state.behind }),
    label: primary ? `${t('git-changes:scm.sync.changes')} ${counts}` : counts,
  }
}

const syncClass = (primary: boolean, pending: boolean): string =>
  cn(
    'h-7 shrink-0 gap-1 px-2 text-xs',
    primary ? 'min-w-0 flex-1' : 'font-mono',
    !primary && pending && 'border-[var(--ac)] bg-[var(--acs)] text-[var(--act)]',
  )

/**
 * VS Code's sync control: `behind↓ ahead↑` (pull then push), or "Publish Branch" without an upstream. Highlighted
 * while there is something to sync; `primary`: the full-width "Sync Changes" button shown instead of Commit.
 */
export function SyncButton(props: {
  state: ScmState | undefined
  busy: boolean
  actions: ScmActions
  primary?: boolean
}) {
  const t = useT()
  const { state, busy, actions } = props
  const primary = props.primary === true
  if (!state?.branch || (state.upstream === null && !state.hasRemote)) return null
  const publish = state.upstream === null
  const pending = hasPendingSync(state)
  const Icon = publish ? CloudUpload : RefreshCw
  const { title, label } = syncTexts(t, { ...state, branch: state.branch }, primary)
  return (
    <Button
      size={SIZE_SM}
      variant={primary ? undefined : VARIANT_OUTLINE}
      data-testid={primary ? T.syncPrimary : T.syncButton}
      data-pending={pending || undefined}
      data-ahead={state.ahead}
      data-behind={state.behind}
      disabled={busy}
      title={title}
      aria-label={title}
      onClick={() => void actions.remote(publish ? PUSH : SYNC)}
      className={syncClass(primary, pending)}
    >
      <Icon size={DIFF_ICON_PX} className={cn(busy && 'animate-spin')} aria-hidden />
      {label}
    </Button>
  )
}
