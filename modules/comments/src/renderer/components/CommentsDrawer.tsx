import { useT } from '@pragma/sdk/renderer'
import { EmptyState } from '@pragma/ui'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@pragma/ui/components/sheet'
import { EMPTY_ICONS } from '../../constants'
import { type Comment, sendErrorI18nKey, COMMENTS_TESTIDS as T } from '../../contract'
import { PrimaryButton, QuietButton } from '../lib/buttons'
import { SEND, useBusy } from '../lib/use-busy'
import { useCommentsStore } from '../store'
import { useSendFlow } from '../use-send-flow'
import { CommentRow } from './CommentRow'

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

/** Selected ids in list order (drafts start selected; sending sends exactly the selection). */
const idsToSend = (drafts: readonly Comment[], selection: ReadonlySet<string>): string[] =>
  drafts.filter((c) => selection.has(c.id)).map((c) => c.id)

function SelectionToggle({ allSelected }: { allSelected: boolean }) {
  const t = useT()
  const s = useCommentsStore.getState
  return (
    <QuietButton data-testid={T.selectionToggle} onClick={() => (allSelected ? s().clearSelection() : s().selectAll())}>
      {t(allSelected ? 'comments:drawer.clearSelection' : 'comments:drawer.selectAll')}
    </QuietButton>
  )
}

function DraftsFooter({ drafts }: { drafts: Comment[] }) {
  const t = useT()
  const flow = useSendFlow()
  const selection = useCommentsStore((s) => s.selection)
  const preferredSessionId = useCommentsStore((s) => s.drawer.preferredSessionId)
  const [busy, run] = useBusy(SEND)
  const ids = idsToSend(drafts, selection)
  const allSelected = drafts.length > 0 && ids.length === drafts.length
  const send = () => run(() => flow.send(ids, { preferredSessionId }))
  const label = t(allSelected ? 'comments:drawer.sendAll' : 'comments:drawer.sendSelected', { count: ids.length })
  return (
    <div className="flex flex-col gap-2 border-t px-4 py-3">
      <ErrorLine />
      <WaitingLine />
      <div className="flex items-center justify-end gap-2">
        {drafts.length ? <SelectionToggle allSelected={allSelected} /> : null}
        <PrimaryButton data-testid={T.sendButton} disabled={busy || ids.length === 0} onClick={() => void send()}>
          {label}
        </PrimaryButton>
      </div>
    </div>
  )
}

/** The worktree's drafts; a delivered comment is deleted, so there is no sent list. */
function DraftsList() {
  const drafts = useCommentsStore((s) => s.drafts)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {drafts.length ? (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {drafts.map((c) => (
            <CommentRow key={c.id} comment={c} />
          ))}
        </ul>
      ) : (
        <Empty
          icon={EMPTY_ICONS.noDrafts}
          titleKey="comments:drawer.emptyDraftsTitle"
          descriptionKey="comments:drawer.emptyDrafts"
        />
      )}
      <DraftsFooter drafts={drafts} />
    </div>
  )
}

/** The Comments drawer: a right-side sheet with the active worktree's drafts. */
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
        {worktreeId ? (
          <DraftsList />
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
