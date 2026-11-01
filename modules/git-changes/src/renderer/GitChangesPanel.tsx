import { useModuleSettings, useT } from '@pragma/sdk/renderer'
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef } from 'react'
import {
  CHANGE_LIST_STATE,
  CHANGE_MODE,
  type ChangedFile,
  type GitChangesSettings,
  GitChangesTestIds as T,
  VIEW_MODES,
} from '../contract'
import { ReviewBar } from './comments/ReviewBar'
import { useDiffReview } from './comments/use-diff-review'
import { DiffView, type DiffViewHandle } from './diff/DiffView'
import { EmptyState } from './EmptyState'
import { keyToAction, NEXT_CHANGE, NEXT_FILE, PREV_FILE } from './keyboard'
import { useActiveWorktree } from './lib/projects'
import { SplitPane } from './SplitPane'
import { useGitChangesStore, useWorktreeView } from './store'
import { type ChangeLists, Toolbar } from './Toolbar'
import { buildFlatList, buildTree, leafOrder, type TreeNode } from './tree/build-tree'
import { ChangesTree } from './tree/ChangesTree'
import { useChangeList } from './use-changes'

const [TREE] = VIEW_MODES
const EMPTY_KINDS = { noWorktree: 'noWorktree', loading: 'loading', failed: 'failed', noChanges: 'noChanges' } as const
const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]'

const isEditable = (target: EventTarget): boolean =>
  target instanceof Element && target.closest(EDITABLE_SELECTOR) !== null

/** The files of the current list in display order (tree or flat). */
function useDisplay(files: ChangedFile[], viewMode: GitChangesSettings['viewMode']) {
  return useMemo(() => {
    const nodes: TreeNode[] = viewMode === TREE ? buildTree(files) : buildFlatList(files)
    const byPath = new Map(files.map((f) => [f.path, f]))
    const ordered = leafOrder(nodes).flatMap((p) => byPath.get(p) ?? [])
    return { nodes, ordered }
  }, [files, viewMode])
}

/** j / k move the selection through the display order (`step` ±1), stopping at both ends. */
function neighbour(ordered: ChangedFile[], selected: string | null, step: number): string | null {
  const index = ordered.findIndex((f) => f.path === selected)
  const next = ordered[Math.min(Math.max(index + step, 0), ordered.length - 1)]
  return next?.path ?? null
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
  const { nodes, ordered } = useDisplay(files, settings.viewMode)
  const selected = files.find((f) => f.path === view.selectedPath) ?? null
  const diffRef = useRef<DiffViewHandle>(null)
  const review = useDiffReview(worktreeId, selected, view.composer)

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
      <Body
        loading={current.data === undefined && current.error === undefined}
        failed={current.error !== undefined}
        noBase={current.data !== undefined && !okList}
        empty={files.length === 0}
        t={t}
      >
        <SplitPane
          left={
            <ChangesTree
              nodes={nodes}
              selectedPath={view.selectedPath}
              onSelect={(path) => store.select(worktreeId, path)}
              commentCounts={review.counts}
            />
          }
          right={
            selected ? (
              <DiffView
                ref={diffRef}
                worktreeId={worktreeId}
                mode={view.mode}
                file={selected}
                settings={settings}
                composer={view.composer}
                composerRange={review.composerRange}
                annotations={review.annotations}
                renderAnnotation={review.renderAnnotation}
                onRange={review.onRange}
              />
            ) : null
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
