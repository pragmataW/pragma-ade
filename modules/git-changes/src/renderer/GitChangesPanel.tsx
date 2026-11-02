import { useModuleSettings, useT } from '@pragma/sdk/renderer'
import { type KeyboardEvent, type ReactNode, type RefObject, useEffect, useMemo, useRef } from 'react'
import {
  CHANGE_LIST_STATE,
  CHANGE_MODE,
  type ChangedFile,
  type ChangeMode,
  type GitChangesSettings,
  type StashEntry,
  GitChangesTestIds as T,
  VIEW_MODES,
} from '../contract'
import { ReviewBar } from './comments/ReviewBar'
import { type DiffReview, useDiffReview } from './comments/use-diff-review'
import { DiffView, type DiffViewHandle } from './diff/DiffView'
import { HunkBar } from './diff/HunkBar'
import { EmptyState } from './EmptyState'
import { keyToAction, NEXT_CHANGE, NEXT_FILE, PREV_FILE } from './keyboard'
import { type EditorOpener, editorOpener } from './lib/editor'
import { useActiveWorktree } from './lib/projects'
import { SplitPane } from './SplitPane'
import { type ScmActions, scmActions } from './scm/actions'
import { ScmBar } from './scm/ScmBar'
import { StashList } from './scm/StashList'
import { useStashes } from './scm/use-scm'
import { useGitChangesStore, useWorktreeView, type WorktreeView } from './store'
import { type ChangeLists, Toolbar } from './Toolbar'
import { buildGroups, entryKey, leafOrder, type TreeNode } from './tree/build-tree'
import { ChangesTree } from './tree/ChangesTree'
import type { RowHandlers } from './tree/RowActions'
import { useChangeList } from './use-changes'

const [TREE] = VIEW_MODES
const EMPTY_KINDS = { noWorktree: 'noWorktree', loading: 'loading', failed: 'failed', noChanges: 'noChanges' } as const
const NO_FILES: ChangedFile[] = []
const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]'

const isEditable = (target: EventTarget): boolean =>
  target instanceof Element && target.closest(EDITABLE_SELECTOR) !== null

/** The tree rows' Stage / Unstage / Discard (uncommitted mode). */
const rowHandlers = (scm: ScmActions): RowHandlers => ({
  stage: (files) => void scm.stage(files),
  unstage: (files) => void scm.unstage(files),
  discard: (files, all) => void scm.discard(files, all),
})

/** The entries of the current list in display order (grouped in uncommitted mode, tree or flat). */
function useDisplay(files: ChangedFile[], viewMode: GitChangesSettings['viewMode'], mode: ChangeMode) {
  return useMemo(() => {
    const nodes = buildGroups(files, { grouped: mode === CHANGE_MODE.uncommitted, flat: viewMode !== TREE })
    const byKey = new Map(files.map((f) => [entryKey(f), f]))
    const ordered = leafOrder(nodes).flatMap((k) => byKey.get(k) ?? [])
    return { nodes, ordered }
  }, [files, viewMode, mode])
}

/** j / k move the selection through the display order (`step` ±1), stopping at both ends. */
function neighbour(ordered: ChangedFile[], selected: string | null, step: number): string | null {
  const index = ordered.findIndex((f) => entryKey(f) === selected)
  const next = ordered[Math.min(Math.max(index + step, 0), ordered.length - 1)]
  return next ? entryKey(next) : null
}

/** The left pane: the change tree (or "No changes") above the Stashes section. */
function FileListPane(props: {
  worktreeId: string
  files: ChangedFile[]
  nodes: TreeNode[]
  view: WorktreeView
  commentCounts: Record<string, number>
  onOpenInEditor?(path: string): void
  handlers?: RowHandlers
  stashes: StashEntry[]
  scm: ScmActions
}) {
  const t = useT()
  const { worktreeId, view } = props
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col">
        {props.files.length === 0 ? (
          <EmptyState kind={EMPTY_KINDS.noChanges} text={t('git-changes:empty.noChanges')} />
        ) : (
          <ChangesTree
            nodes={props.nodes}
            selectedPath={view.selectedPath}
            onSelect={(key) => useGitChangesStore.getState().select(worktreeId, key)}
            commentCounts={props.commentCounts}
            onOpenInEditor={props.onOpenInEditor}
            handlers={props.handlers}
          />
        )}
      </div>
      <StashList worktreeId={worktreeId} stashes={props.stashes} selected={view.stashFile} actions={props.scm} />
    </div>
  )
}

/** The right pane: a stash file's diff, else the selected entry's diff (with hunk actions when uncommitted). */
function DiffPane(props: {
  worktreeId: string
  view: WorktreeView
  selected: ChangedFile | null
  settings: GitChangesSettings
  review: DiffReview
  diffRef: RefObject<DiffViewHandle | null>
  onOpenInEditor: EditorOpener | null
}) {
  const { worktreeId, view, selected, settings, review } = props
  if (view.stashFile)
    return (
      <DiffView
        worktreeId={worktreeId}
        mode={view.mode}
        file={view.stashFile.file}
        stash={view.stashFile.sha}
        settings={settings}
      />
    )
  if (!selected) return null
  return (
    <DiffView
      ref={props.diffRef}
      worktreeId={worktreeId}
      mode={view.mode}
      file={selected}
      settings={settings}
      composer={view.composer}
      composerRange={review.composerRange}
      annotations={review.annotations}
      renderAnnotation={review.renderAnnotation}
      onRange={review.onRange}
      onOpenInEditor={props.onOpenInEditor}
      hunkBar={view.mode === CHANGE_MODE.uncommitted ? <HunkBar worktreeId={worktreeId} file={selected} /> : null}
    />
  )
}

function WorktreeChanges({ worktreeId }: { worktreeId: string }) {
  const t = useT()
  const settings = useModuleSettings<GitChangesSettings>()
  const view = useWorktreeView(worktreeId)
  const store = useGitChangesStore.getState()
  const uncommitted = useChangeList(worktreeId, CHANGE_MODE.uncommitted)
  const branch = useChangeList(worktreeId, CHANGE_MODE.branch)
  const current = view.mode === CHANGE_MODE.uncommitted ? uncommitted : branch
  const lists: ChangeLists = { uncommitted: uncommitted.data, branch: branch.data }
  const okList = current.data?.state === CHANGE_LIST_STATE.ok ? current.data : undefined
  const files = useMemo(() => okList?.files ?? [], [okList])
  const { nodes, ordered } = useDisplay(files, settings.viewMode, view.mode)
  const selected = files.find((f) => entryKey(f) === view.selectedPath) ?? null
  const diffRef = useRef<DiffViewHandle>(null)
  const review = useDiffReview(worktreeId, selected, view.composer)
  const openInEditor = editorOpener({ worktreeId, mode: view.mode, mergeBase: okList?.mergeBase ?? null })
  const openPathInEditor = openInEditor
    ? (path: string) => {
        const file = files.find((f) => f.path === path)
        if (file) openInEditor(file)
      }
    : undefined
  const scm = useMemo(() => scmActions(worktreeId), [worktreeId])
  const stashes = useStashes(worktreeId)
  const isUncommitted = view.mode === CHANGE_MODE.uncommitted
  const uncommittedFiles = uncommitted.data?.state === CHANGE_LIST_STATE.ok ? uncommitted.data.files : NO_FILES

  useEffect(() => {
    if (okList) useGitChangesStore.getState().reconcile(worktreeId, ordered)
  }, [okList, ordered, worktreeId])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const action = keyToAction({ ...e, targetIsEditable: isEditable(e.target) })
    if (action === null) return
    e.preventDefault()
    if (action === NEXT_FILE || action === PREV_FILE)
      store.select(worktreeId, neighbour(ordered, view.selectedPath, action === NEXT_FILE ? 1 : -1))
    else if (action === NEXT_CHANGE) diffRef.current?.nextChange()
    else diffRef.current?.prevChange()
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: panel-wide j/k/n shortcuts while focus is inside the panel
    <div data-testid={T.panel} className="flex h-full min-h-0 flex-col" onKeyDown={onKeyDown}>
      <Toolbar
        worktreeId={worktreeId}
        mode={view.mode}
        lists={lists}
        settings={settings}
        onModeChange={(m) => store.setMode(worktreeId, m)}
      />
      <ScmBar worktreeId={worktreeId} files={uncommittedFiles} stashes={stashes} actions={scm} />
      <Body
        loading={current.data === undefined && current.error === undefined}
        failed={current.error !== undefined}
        noBase={current.data !== undefined && !okList}
        empty={files.length === 0 && stashes.length === 0}
        t={t}
      >
        <SplitPane
          left={
            <FileListPane
              worktreeId={worktreeId}
              files={files}
              nodes={nodes}
              view={view}
              commentCounts={review.counts}
              onOpenInEditor={openPathInEditor}
              handlers={isUncommitted ? rowHandlers(scm) : undefined}
              stashes={stashes}
              scm={scm}
            />
          }
          right={
            <DiffPane
              worktreeId={worktreeId}
              view={view}
              selected={selected}
              settings={settings}
              review={review}
              diffRef={diffRef}
              onOpenInEditor={openInEditor}
            />
          }
        />
      </Body>
      <ReviewBar comments={review.comments} fileName={selected?.path ?? ''} />
    </div>
  )
}

function Body(props: {
  loading: boolean
  failed: boolean
  noBase: boolean
  empty: boolean
  t: ReturnType<typeof useT>
  children: ReactNode
}) {
  const { t } = props
  if (props.failed) return <EmptyState kind={EMPTY_KINDS.failed} text={t('git-changes:errors.loadFailed')} />
  if (props.loading) return <EmptyState kind={EMPTY_KINDS.loading} text={t('git-changes:empty.loading')} />
  if (props.noBase) return null
  if (props.empty) return <EmptyState kind={EMPTY_KINDS.noChanges} text={t('git-changes:empty.noChanges')} />
  return props.children
}

/** The Git Changes right tab: toolbar, file tree, diff and review bar of the active worktree. */
export function GitChangesPanel(_props: { tabId: string }) {
  const t = useT()
  const active = useActiveWorktree()
  if (!active) return <EmptyState kind={EMPTY_KINDS.noWorktree} text={t('git-changes:empty.noWorktree')} />
  return <WorktreeChanges key={active.id} worktreeId={active.id} />
}
