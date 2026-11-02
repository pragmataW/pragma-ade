import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Button } from '@pragma/ui/components/button'
import { CloudUpload, RefreshCw } from '@pragma/ui/icons'
import { DIFF_ICON_PX, SIZE_SM, VARIANT_OUTLINE } from '../../constants'
import { REMOTE_ACTIONS, type ScmState, GitChangesTestIds as T } from '../../contract'
import type { ScmActions } from './actions'

const [, , , PUSH, SYNC] = REMOTE_ACTIONS

/** VS Code's sync control: `behind↓ ahead↑` (pull then push), or "Publish Branch" without an upstream. */
export function SyncButton(props: { state: ScmState | undefined; busy: boolean; actions: ScmActions }) {
  const t = useT()
  const { state, busy, actions } = props
  if (!state?.branch) return null
  const publish = state.upstream === null
  const Icon = publish ? CloudUpload : RefreshCw
  const title = publish
    ? t('git-changes:scm.sync.publishTitle', { branch: state.branch })
    : t('git-changes:scm.sync.title', { upstream: state.upstream, ahead: state.ahead, behind: state.behind })
  return (
    <Button
      size={SIZE_SM}
      variant={VARIANT_OUTLINE}
      data-testid={T.syncButton}
      data-ahead={state.ahead}
      data-behind={state.behind}
      disabled={busy}
      title={title}
      aria-label={title}
      onClick={() => void actions.remote(publish ? PUSH : SYNC)}
      className="h-7 shrink-0 gap-1 px-2 font-mono text-xs"
    >
      <Icon size={DIFF_ICON_PX} className={cn(busy && 'animate-spin')} aria-hidden />
      {publish
        ? t('git-changes:scm.sync.publish')
        : t('git-changes:scm.sync.counts', { ahead: state.ahead, behind: state.behind })}
    </Button>
  )
}
