import { useT } from '@pragma/sdk/renderer'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@pragma/ui/components/sheet'
import { sendErrorI18nKey, COMMENTS_TESTIDS as T } from '../../contract'
import { PrimaryButton, QuietButton } from '../lib/buttons'
import { SEND, useBusy } from '../lib/use-busy'
import { selectPending, useCommentsStore } from '../store'
import { useSendFlow } from '../use-send-flow'
import { CommentRow } from './CommentRow'

function Empty({ children }: { children: string }) {
  return <p className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">{children}</p>
}

function ErrorLine() {
  const t = useT()
  const error = useCommentsStore((s) => s.lastError)
  if (!error) return null
  return (
    <p data-testid={T.error} role="alert" className="text-[12px] text-destructive">
      {t(sendErrorI18nKey(error))}
    </p>
  )
}

function WaitingLine() {
  const t = useT()
  const flow = useSendFlow()
  const launch = useCommentsStore((s) => s.launchSuggestion)
  if (!launch?.waiting) return null
  return (
    <div className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
      <span>{t('comments:launch.waiting')}</span>
      <QuietButton onClick={() => void flow.cancelLaunch(launch.worktreeId)}>{t('comments:launch.cancel')}</QuietButton>
    </div>
  )
}

function SendFooter() {
  const t = useT()
  const flow = useSendFlow()
  const pending = useCommentsStore(selectPending)
  const preferredSessionId = useCommentsStore((s) => s.drawer.preferredSessionId)
  const [busy, run] = useBusy(SEND)
  const send = () => run(() => flow.send({ preferredSessionId }))
  return (
    <div className="flex flex-col gap-2 border-t px-4 py-3">
      <ErrorLine />
      <WaitingLine />
      <div className="flex items-center justify-end gap-2">
        <PrimaryButton data-testid={T.sendButton} disabled={busy || pending === 0} onClick={() => void send()}>
          {pending ? t('comments:drawer.sendPending', { count: pending }) : t('comments:drawer.nothingToSend')}
        </PrimaryButton>
      </div>
    </div>
  )
}

/** The worktree's review threads. */
function ThreadsList() {
  const t = useT()
  const drafts = useCommentsStore((s) => s.threads)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {drafts.map((c) => (
          <CommentRow key={c.id} comment={c} />
        ))}
      </ul>
      {drafts.length ? null : <Empty>{t('comments:drawer.emptyThreads')}</Empty>}
      <SendFooter />
    </div>
  )
}

/** The Comments drawer: a right-side sheet with the active worktree's review threads. */
export function CommentsDrawer() {
  const t = useT()
  const open = useCommentsStore((s) => s.drawer.open)
  const worktreeId = useCommentsStore((s) => s.activeWorktreeId)
  return (
    <Sheet open={open} onOpenChange={(o) => (o ? undefined : useCommentsStore.getState().closeDrawer())}>
      <SheetContent data-testid={T.drawer} side="right" className="w-[420px] gap-0 p-0 sm:max-w-[420px]">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle>{t('comments:drawer.title')}</SheetTitle>
          <SheetDescription className="sr-only">{t('comments:drawer.description')}</SheetDescription>
        </SheetHeader>
        {worktreeId ? <ThreadsList /> : <Empty>{t('comments:drawer.noWorktree')}</Empty>}
      </SheetContent>
    </Sheet>
  )
}
