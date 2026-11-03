import { useT } from '@pragma/sdk/renderer'
import { EmptyState } from '@pragma/ui'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@pragma/ui/components/sheet'
import { ChevronDown, ChevronRight, CircleCheck } from '@pragma/ui/icons'
import { useState } from 'react'
import { BUTTON_TYPE, EMPTY_ICONS } from '../../constants'
import { COMMENT_STATUS, type Comment, sendErrorI18nKey, COMMENTS_TESTIDS as T } from '../../contract'
import { clearResolved } from '../clear-resolved'
import { PrimaryButton, QuietButton } from '../lib/buttons'
import { CLEAR, SEND, useBusy } from '../lib/use-busy'
import { selectPending, useCommentsStore } from '../store'
import { useSendFlow } from '../use-send-flow'
import { ThreadGroups } from './ThreadGroups'

const ICON_PX = 14
/** Esc in a reply or edit box cancels that box (its own handler), not the drawer. */
const keepOpenWhileTyping = (e: KeyboardEvent) => {
  if (e.target instanceof HTMLTextAreaElement) e.preventDefault()
}

function Empty({ icon, titleKey, descriptionKey }: { icon: string; titleKey: string; descriptionKey: string }) {
  const t = useT()
  return <EmptyState icon={icon} title={t(titleKey)} description={t(descriptionKey)} />
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
    <div className="flex flex-col gap-2 border-[var(--bd)] border-t px-4 py-2.5">
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
    <div data-testid={T.resolvedSection} className="border-[var(--bd)] border-t">
      <button
        type={BUTTON_TYPE}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-9 w-full items-center gap-1.5 px-4 text-left font-medium text-[12px] text-muted-foreground hover:bg-[var(--hv)] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
      >
        {open ? <ChevronDown size={ICON_PX} aria-hidden /> : <ChevronRight size={ICON_PX} aria-hidden />}
        <CircleCheck size={ICON_PX - 1} aria-hidden className="text-[var(--ok)]" />
        {t('comments:drawer.resolvedSection', { count: threads.length })}
      </button>
      {open ? <ThreadGroups threads={threads} /> : null}
    </div>
  )
}

/** The worktree's open threads grouped by file, then a collapsed "Resolved (n)" section (grouped too). */
function ThreadsList() {
  const threads = useCommentsStore((s) => s.threads)
  const open = threads.filter((c) => c.status === COMMENT_STATUS.open)
  const resolved = threads.filter((c) => c.status === COMMENT_STATUS.resolved)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {threads.length ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ThreadGroups threads={open} />
          <ResolvedSection threads={resolved} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col justify-center">
          <Empty
            icon={EMPTY_ICONS.noThreads}
            titleKey="comments:drawer.emptyThreadsTitle"
            descriptionKey="comments:drawer.emptyThreads"
          />
        </div>
      )}
      <SendFooter />
    </div>
  )
}

/** Round chip and "Clear resolved" (confirmed through the SDK dialog) next to the title. */
function HeaderActions({ worktreeId }: { worktreeId: string }) {
  const t = useT()
  const round = useCommentsStore((s) => s.round)
  const resolved = useCommentsStore((s) => s.threads.some((c) => c.status === COMMENT_STATUS.resolved))
  const [busy, run] = useBusy(CLEAR)
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {round ? (
        <span className="rounded-[var(--radius-chip)] bg-[var(--hv)] px-1.5 py-px text-[11px] text-muted-foreground">
          {t('comments:drawer.round', { round })}
        </span>
      ) : null}
      {resolved ? (
        <QuietButton
          data-testid={T.clearResolved}
          disabled={busy}
          className="ml-auto h-7 px-2 text-[12px] text-muted-foreground hover:text-foreground"
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
        className="w-[440px] max-w-[calc(100vw-24px)] gap-0 bg-[var(--pn)] p-0 sm:max-w-[440px]"
        onEscapeKeyDown={keepOpenWhileTyping}
      >
        <SheetHeader className="flex-row items-center gap-2.5 border-[var(--bd)] border-b px-4 py-2.5">
          <SheetTitle className="shrink-0 font-semibold text-[15px]">{t('comments:drawer.title')}</SheetTitle>
          <SheetDescription className="sr-only">{t('comments:drawer.description')}</SheetDescription>
          {worktreeId ? <HeaderActions worktreeId={worktreeId} /> : null}
        </SheetHeader>
        {worktreeId ? (
          <ThreadsList />
        ) : (
          <Empty
            icon={EMPTY_ICONS.noWorktree}
            titleKey="comments:drawer.noWorktreeTitle"
            descriptionKey="comments:drawer.noWorktree"
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
