import { useT } from '@pragma/sdk/renderer'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@pragma/ui/components/dialog'
import { COMMENTS_TESTIDS as T } from '../../contract'
import { PrimaryButton, QuietButton } from '../lib/buttons'
import { useCommentsStore } from '../store'
import { useSendFlow } from '../use-send-flow'

const close = () => useCommentsStore.getState().closeLaunchSuggestion()

/**
 * "No agent running → Start agent". Start queues the comments for the next session of the worktree and opens 03's
 * launcher; this dialog and the drawer close so the launcher is the only modal, and the drawer shows the wait.
 */
export function LaunchSuggestionDialog() {
  const t = useT()
  const flow = useSendFlow()
  const launch = useCommentsStore((s) => s.launchSuggestion)
  const start = () => {
    if (!launch) return
    useCommentsStore.getState().closeDrawer()
    flow
      .startAgentAndSend(launch.worktreeId, launch.commentIds)
      .catch((e: unknown) => console.warn('comments: start agent failed', e))
  }
  return (
    <Dialog open={launch !== null && !launch.waiting} onOpenChange={(open) => (open ? undefined : close())}>
      <DialogContent data-testid={T.launchSuggestion} className="max-w-[420px]">
        <DialogTitle>{t('comments:launch.title')}</DialogTitle>
        <DialogDescription>
          {t('comments:launch.description', { count: launch?.commentIds.length ?? 0 })}
        </DialogDescription>
        <DialogFooter>
          <QuietButton onClick={close}>{t('comments:launch.cancel')}</QuietButton>
          <PrimaryButton data-testid={T.launchStart} onClick={start}>
            {t('comments:launch.start')}
          </PrimaryButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
