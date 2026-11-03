import { useModuleSettings, useT } from '@pragma/sdk/renderer'
import { Archive, X } from '@pragma/ui/icons'
import { type KeyboardEvent, type ReactNode, type RefObject, useEffect, useMemo, useRef } from 'react'
import { BUTTON_TYPE, DIFF_ICON_PX } from '../constants'
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
import { FilterBar, NoMatches } from './filter/FilterBar'
import { type FileFilter, filterFiles } from './filter/filter-files'
import { type ParsedQuery, parseQuery } from './filter/match'
import { type KeyAction, keyToAction } from './keyboard'
import { type EditorOpener, editorOpener } from './lib/editor'
import { useActiveWorktree } from './lib/projects'
import { SplitPane } from './SplitPane'
import { type ScmActions, scmActions } from './scm/actions'
import { ScmBar } from './scm/ScmBar'
import { StashButtons, StashList, stashLabel } from './scm/StashList'
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

interface Display {
  nodes: TreeNode[]
  ordered: ChangedFile[]
}

function display(files: readonly ChangedFile[], opts: Parameters<typeof buildGroups>[1]): Display {
  const nodes = buildGroups(files, opts)
  const byKey = new Map(files.map((f) => [entryKey(f), f]))
  return { nodes, ordered: leafOrder(nodes).flatMap((k) => byKey.get(k) ?? []) }
}

/**
 * The entries of the current list in display order (grouped in uncommitted mode, tree or flat): `full` unfiltered
 * (the selection reconciles against it, so filtering never moves it), `shown` through the file filter.
 */
function useDisplay(
  files: ChangedFile[],
  filter: FileFilter,
  viewMode: GitChangesSettings['viewMode'],
  mode: ChangeMode,
) {
  return useMemo(() => {
    const opts = { grouped: mode === CHANGE_MODE.uncommitted, flat: viewMode !== TREE }
    const full = display(files, opts)
    return { full, shown: filter.active ? display(filter.visible, { ...opts, all: files }) : full }
  }, [files, filter, viewMode, mode])
}

/** The file filter of a worktree: its query (kept in the store) parsed, and the list through it. */
function useFileFilter(files: readonly ChangedFile[], text: string): { query: ParsedQuery; filter: FileFilter } {
  const query = useMemo(() => parseQuery(text), [text])
  const filter = useMemo(() => filterFiles(files, query), [files, query])
  return { query, filter }
}

/** j / k move the selection through the display order (`step` ±1), stopping at both ends. */
function neighbour(ordered: ChangedFile[], selected: string | null, step: number): string | null {
  const index = ordered.findIndex((f) => entryKey(f) === selected)
  const next = ordered[Math.min(Math.max(index + step, 0), ordered.length - 1)]
  return next ? entryKey(next) : null
}

/** The left pane: the file filter, the change tree (or "No changes" / "No matches") above the Stashes section. */
function FileListPane(props: {
  worktreeId: string
  files: ChangedFile[]
  nodes: TreeNode[]
  /** The best match (Enter in the filter selects it). */
  first: ChangedFile | undefined
  view: WorktreeView
  filter: FileFilter
  query: ParsedQuery
  commentCounts: Record<string, number>
  onOpenInEditor?(path: string): void
  handlers?: RowHandlers
  stashes: StashEntry[]
  scm: ScmActions
  filterRef: RefObject<HTMLInputElement | null>
}) {
  const t = useT()
  const { worktreeId, view, filter } = props
  const store = useGitChangesStore.getState()
  const setFilter = (text: string) => store.setFilter(worktreeId, text)
  const reset = () => {
    setFilter('')
    props.filterRef.current?.focus()
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <FilterBar
        value={view.filter}
        filter={filter}
        onChange={setFilter}
        onSubmit={() => {
          if (props.first) store.select(worktreeId, entryKey(props.first))
        }}
        inputRef={props.filterRef}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        {props.files.length === 0 ? (
          <EmptyState kind={EMPTY_KINDS.noChanges} text={t('git-changes:empty.noChanges')} />
        ) : filter.active && filter.visible.length === 0 ? (
          <NoMatches query={view.filter} onReset={reset} />
        ) : (
          <ChangesTree
            nodes={props.nodes}
            selectedPath={view.selectedPath}
            onSelect={(key) => store.select(worktreeId, key)}
            commentCounts={props.commentCounts}
            onOpenInEditor={props.onOpenInEditor}
            handlers={props.handlers}
            matches={filter.matches}
          />
        )}
      </div>
      <StashList
        worktreeId={worktreeId}
        stashes={props.stashes}
        selected={view.stashFile}
        actions={props.scm}
        query={props.query}
      />
    </div>
  )
}

/** Above a stash file's diff: whose content this is, its Apply / Pop / Drop, and a way back to the changes. */
function StashBanner(props: { worktreeId: string; entry: StashEntry | undefined; scm: ScmActions }) {
  const t = useT()
  const close = t('git-changes:scm.stash.close')
  return (
    <div
      data-testid={T.stashBanner}
      className="flex h-7 shrink-0 items-center gap-2 border-[var(--bd)] border-b bg-[var(--el)] px-2 text-[12px]"
    >
      <Archive size={DIFF_ICON_PX} className="shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-[60px] flex-1 truncate" title={props.entry?.message}>
        {t('git-changes:scm.stash.viewing', { message: stashLabel(props.entry?.message ?? '') })}
      </span>
      {props.entry ? <StashButtons entry={props.entry} actions={props.scm} labelled /> : null}
      <button
        type={BUTTON_TYPE}
        aria-label={close}
        title={close}
        onClick={() => useGitChangesStore.getState().showStashFile(props.worktreeId, null)}
        className="flex size-[18px] items-center justify-center rounded text-muted-foreground hover:bg-[var(--bd)] hover:text-[var(--tx)]"
      >
        <X size={DIFF_ICON_PX} aria-hidden />
      </button>
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
  stashes: readonly StashEntry[]
  scm: ScmActions
}) {
  const { worktreeId, view, selected, settings, review } = props
  if (view.stashFile) {
    const sha = view.stashFile.sha
    return (
      <div className="flex h-full min-h-0 flex-col">
        <StashBanner worktreeId={worktreeId} entry={props.stashes.find((s) => s.sha === sha)} scm={props.scm} />
        <div className="min-h-0 flex-1">
          <DiffView
            worktreeId={worktreeId}
            mode={view.mode}
            file={view.stashFile.file}
            stash={sha}
            settings={settings}
          />
        </div>
      </div>
    )
  }
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
  const { query, filter } = useFileFilter(files, view.filter)
  const { full, shown } = useDisplay(files, filter, settings.viewMode, view.mode)
  const selected = files.find((f) => entryKey(f) === view.selectedPath) ?? null
  const diffRef = useRef<DiffViewHandle>(null)
  const filterRef = useRef<HTMLInputElement>(null)
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
    if (okList) useGitChangesStore.getState().reconcile(worktreeId, full.ordered)
  }, [okList, full, worktreeId])

  const focusFilter = () => {
    filterRef.current?.focus()
    filterRef.current?.select()
  }
  const run: Record<KeyAction, () => void> = {
    nextFile: () => store.select(worktreeId, neighbour(shown.ordered, view.selectedPath, 1)),
    prevFile: () => store.select(worktreeId, neighbour(shown.ordered, view.selectedPath, -1)),
    nextChange: () => diffRef.current?.nextChange(),
    prevChange: () => diffRef.current?.prevChange(),
    // Without an open diff there is nothing to find in: Cmd/Ctrl+F filters the files instead.
    find: () => (diffRef.current ? diffRef.current.openFind() : focusFilter()),
    filter: focusFilter,
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const action = keyToAction({ ...e, targetIsEditable: isEditable(e.target) })
    if (action === null) return
    e.preventDefault()
    run[action]()
  }

  return (
    // tabIndex: a click anywhere in the panel (diff text included) focuses it, so its shortcuts (Cmd/Ctrl+F) reach here.
    // biome-ignore lint/a11y/noStaticElementInteractions: panel-wide j/k/n and Cmd/Ctrl+F while focus is inside
    <div
      data-testid={T.panel}
      tabIndex={-1}
      className="flex h-full min-h-0 flex-col outline-none"
      onKeyDown={onKeyDown}
    >
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
              nodes={shown.nodes}
              first={filter.active ? filter.visible[0] : undefined}
              view={view}
              filter={filter}
              query={query}
              filterRef={filterRef}
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
              stashes={stashes}
              scm={scm}
            />
          }
        />
      </Body>
      <ReviewBar worktreeId={worktreeId} threads={review.threads} fileName={selected?.path ?? ''} />
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
