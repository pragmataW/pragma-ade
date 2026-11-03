import { useT } from '@pragma/sdk/renderer'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@pragma/ui/components/sheet'
import { ChevronDown, ChevronRight } from '@pragma/ui/icons'
import { useState } from 'react'
import { COMMENT_STATUS, type Comment, sendErrorI18nKey, COMMENTS_TESTIDS as T } from '../../contract'
import { clearResolved } from '../clear-resolved'
import { PrimaryButton, QuietButton } from '../lib/buttons'
import { CLEAR, SEND, useBusy } from '../lib/use-busy'
import { selectPending, useCommentsStore } from '../store'
import { useSendFlow } from '../use-send-flow'
import { CommentRow } from './CommentRow'

const ICON_PX = 14
/** Esc in a reply or edit box cancels that box (its own handler), not the drawer. */
const keepOpenWhileTyping = (e: KeyboardEvent) => {
  if (e.target instanceof HTMLTextAreaElement) e.preventDefault()
}

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

function ResolvedSection({ threads }: { threads: Comment[] }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  if (!threads.length) return null
  return (
    <li data-testid={T.resolvedSection} className="border-b">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-4 py-2 text-left text-[12px] text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown size={ICON_PX} aria-hidden /> : <ChevronRight size={ICON_PX} aria-hidden />}
        {t('comments:drawer.resolvedSection', { count: threads.length })}
      </button>
      {open ? (
        <ul>
          {threads.map((c) => (
            <CommentRow key={c.id} comment={c} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/** The worktree's open threads, then a collapsed "Resolved (n)" section. */
function ThreadsList() {
  const t = useT()
  const threads = useCommentsStore((s) => s.threads)
  const open = threads.filter((c) => c.status === COMMENT_STATUS.open)
  const resolved = threads.filter((c) => c.status === COMMENT_STATUS.resolved)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {open.map((c) => (
          <CommentRow key={c.id} comment={c} />
        ))}
        <ResolvedSection threads={resolved} />
      </ul>
      {threads.length ? null : <Empty>{t('comments:drawer.emptyThreads')}</Empty>}
      <SendFooter />
    </div>
  )
}

/** Round label and "Clear resolved" (confirmed through the SDK dialog) above the list. */
function HeaderActions({ worktreeId }: { worktreeId: string }) {
  const t = useT()
  const round = useCommentsStore((s) => s.round)
  const resolved = useCommentsStore((s) => s.threads.some((c) => c.status === COMMENT_STATUS.resolved))
  const [busy, run] = useBusy(CLEAR)
  return (
    <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
      {round ? <span>{t('comments:drawer.round', { round })}</span> : null}
      {resolved ? (
        <QuietButton
          data-testid={T.clearResolved}
          disabled={busy}
          className="ml-auto"
          onClick={() => void run(() => clearResolved(worktreeId))}
        >
          {t('comments:drawer.clearResolved')}
        </QuietButton>
      ) : null}
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
      <SheetContent
        data-testid={T.drawer}
        side="right"
        className="w-[420px] gap-0 p-0 sm:max-w-[420px]"
        onEscapeKeyDown={keepOpenWhileTyping}
      >
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle>{t('comments:drawer.title')}</SheetTitle>
          <SheetDescription className="sr-only">{t('comments:drawer.description')}</SheetDescription>
          {worktreeId ? <HeaderActions worktreeId={worktreeId} /> : null}
        </SheetHeader>
        {worktreeId ? <ThreadsList /> : <Empty>{t('comments:drawer.noWorktree')}</Empty>}
      </SheetContent>
    </Sheet>
  )
}
