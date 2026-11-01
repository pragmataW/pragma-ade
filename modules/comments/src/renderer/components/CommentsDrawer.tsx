import { useT } from '@pragma/sdk/renderer'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@pragma/ui/components/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@pragma/ui/components/tabs'
import { useEffect, useState } from 'react'
import {
  type Comment,
  commentsIpc,
  DRAWER_TABS,
  type DrawerTab,
  sendErrorI18nKey,
  COMMENTS_TESTIDS as T,
  TARGET_KIND,
  type TargetResolution,
} from '../../contract'
import { PrimaryButton, QuietButton } from '../lib/buttons'
import { SEND, useBusy } from '../lib/use-busy'
import { runtime } from '../runtime'
import { useCommentsStore } from '../store'
import { useSendFlow } from '../use-send-flow'
import { CommentRow } from './CommentRow'

const [DRAFTS, SENT] = DRAWER_TABS
const SENT_TIME = new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' })
const TAB_TESTIDS = { drafts: T.drawerTabDrafts, sent: T.drawerTabSent } as const satisfies Record<DrawerTab, string>
const TAB_KEYS = { drafts: 'comments:drawer.tabs.drafts', sent: 'comments:drawer.tabs.sent' } as const

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

function DraftsTab() {
  const t = useT()
  const drafts = useCommentsStore((s) => s.drafts)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {drafts.map((c) => (
          <CommentRow key={c.id} comment={c} selectable />
        ))}
      </ul>
      {drafts.length ? null : <Empty>{t('comments:drawer.emptyDrafts')}</Empty>}
      <DraftsFooter drafts={drafts} />
    </div>
  )
}

const titlesOf = (r: TargetResolution): Map<string, string> => {
  if (r.kind === TARGET_KIND.single) return new Map([[r.session.id, r.session.title]])
  if (r.kind === TARGET_KIND.choose) return new Map(r.sessions.map((s) => [s.id, s.title]))
  return new Map()
}

/** Titles of the worktree's running sessions (sent rows to closed sessions say "a closed session"). */
function useSessionTitles(worktreeId: string): ReadonlyMap<string, string> {
  const [titles, setTitles] = useState<ReadonlyMap<string, string>>(new Map())
  useEffect(() => {
    let live = true
    runtime()
      .ipc.invoke(commentsIpc.resolveTarget, { worktreeId })
      .then((r) => live && setTitles(titlesOf(r)))
      .catch((e: unknown) => console.warn('comments: resolveTarget failed', e))
    return () => {
      live = false
    }
  }, [worktreeId])
  return titles
}

function SentTab({ worktreeId }: { worktreeId: string }) {
  const t = useT()
  const sent = useCommentsStore((s) => s.sent)
  const titles = useSessionTitles(worktreeId)
  if (!sent.length) return <Empty>{t('comments:drawer.emptySent')}</Empty>
  return (
    <ul className="min-h-0 flex-1 overflow-y-auto">
      {sent.map((c) => {
        const target = (c.targetSessionId && titles.get(c.targetSessionId)) || t('comments:drawer.closedSession')
        const time = SENT_TIME.format(c.sentAt ?? c.updatedAt)
        return (
          <CommentRow
            key={c.id}
            comment={c}
            selectable={false}
            footer={t('comments:drawer.sentTo', { target, time })}
          />
        )
      })}
    </ul>
  )
}

function DrawerTabs({ worktreeId }: { worktreeId: string }) {
  const t = useT()
  const tab = useCommentsStore((s) => s.drawer.tab)
  const counts = { drafts: useCommentsStore((s) => s.drafts.length), sent: useCommentsStore((s) => s.sent.length) }
  return (
    <Tabs
      value={tab}
      onValueChange={(v) => useCommentsStore.getState().setTab(v as DrawerTab)}
      className="flex min-h-0 flex-1 flex-col gap-0"
    >
      <TabsList className="mx-4 my-2">
        {DRAWER_TABS.map((id) => (
          <TabsTrigger key={id} value={id} data-testid={TAB_TESTIDS[id]}>
            {t(TAB_KEYS[id])}
            {counts[id] ? <span className="ml-1 text-muted-foreground">{counts[id]}</span> : null}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={DRAFTS} className="flex min-h-0 flex-1 flex-col">
        <DraftsTab />
      </TabsContent>
      <TabsContent value={SENT} className="flex min-h-0 flex-1 flex-col">
        <SentTab worktreeId={worktreeId} />
      </TabsContent>
    </Tabs>
  )
}

/** The Comments drawer: a right-side sheet with Drafts and Sent for the active worktree. */
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
        {worktreeId ? <DrawerTabs worktreeId={worktreeId} /> : <Empty>{t('comments:drawer.noWorktree')}</Empty>}
      </SheetContent>
    </Sheet>
  )
}
