import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { FileIcon } from '@pragma/ui/components/file-icon'
import { ChevronDown, ChevronRight, MessageSquare } from '@pragma/ui/icons'
import {
  type CSSProperties,
  createContext,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { type NodeRendererProps, Tree, type TreeApi } from 'react-arborist'
import {
  FILE_ID_PREFIX,
  TREE_FALLBACK_HEIGHT_PX,
  TREE_ICON_PX,
  TREE_INDENT_PX,
  TREE_ROW_HEIGHT_PX,
} from '../../constants'
import { FILE_STATUS, type FileStatus, GitChangesTestIds as T } from '../../contract'
import { entryKey, TREE_NODE_KINDS, type TreeNode } from './build-tree'
import { RowActions, type RowHandlers, rowButtons } from './RowActions'
import { RowMenu, type RowMenuAt } from './RowMenu'

export interface ChangesTreeProps {
  nodes: TreeNode[]
  /** The selected entry's key (`entryKey`). */
  selectedPath: string | null
  onSelect(key: string): void
  /** Draft diff comments per file path (marker next to the name). */
  commentCounts?: Record<string, number>
  treeRef?: RefObject<TreeApi<TreeNode> | null>
  /** File rows get a right-click menu with "Open diff in editor" (absent without the editor module). */
  onOpenInEditor?(path: string): void
  /** Uncommitted mode: inline Stage / Unstage / Discard buttons and menu items. */
  handlers?: RowHandlers
}

const RENAME_ARROW = ' → '
const [, FILE_KIND, GROUP_KIND] = TREE_NODE_KINDS
/** Deleted files are struck through (ui-notes); inline so it holds without the stylesheet. */
const DELETED_NAME: CSSProperties = { textDecorationLine: 'line-through' }
const NO_COUNTS: Record<string, number> = {}

/** Height of the tree's container (react-window needs a number); a fixed fallback until it is measured. */
function useContainerHeight(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null)
  const [height, setHeight] = useState(TREE_FALLBACK_HEIGHT_PX)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const h = Math.floor(entry?.contentRect.height ?? 0)
      if (h > 0) setHeight(h)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, height]
}

const titleOf = (n: TreeNode): string =>
  n.file?.status === FILE_STATUS.R && n.file.oldPath ? `${n.file.oldPath}${RENAME_ARROW}${n.path}` : n.path

function StatusLetter({ status }: { status: FileStatus }) {
  const t = useT()
  return (
    <span
      className={cn('ml-1 w-3 shrink-0 text-center font-mono font-semibold text-[11px]', `gc-status-${status}`)}
      title={t(`git-changes:status.name.${status}`)}
    >
      {t(`git-changes:status.letter.${status}`)}
    </span>
  )
}

/** A group header ("Staged Changes" / "Changes"): section-label type, entry count. */
function GroupLabel({ node, actions }: { node: NodeRendererProps<TreeNode>['node']; actions: ReactNode }) {
  const t = useT()
  const Chevron = node.isOpen ? ChevronDown : ChevronRight
  return (
    <>
      <Chevron size={TREE_ICON_PX} className="shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.06em]">
        {t(`git-changes:groups.${node.data.group}`)}
      </span>
      {actions}
      <span className="shrink-0 rounded-full bg-[var(--hv)] px-1.5 text-[11px] text-muted-foreground">
        {node.data.fileCount}
      </span>
    </>
  )
}

function DirLabel({ node, actions }: { node: NodeRendererProps<TreeNode>['node']; actions: ReactNode }) {
  const Chevron = node.isOpen ? ChevronDown : ChevronRight
  return (
    <>
      <Chevron size={TREE_ICON_PX} className="shrink-0 text-muted-foreground" aria-hidden />
      <FileIcon path={node.data.name} folder open={node.isOpen} size={TREE_ICON_PX} />
      <span className="min-w-0 flex-1 truncate">{node.data.name}</span>
      {actions}
      <span className="shrink-0 text-[11px] text-muted-foreground">{node.data.fileCount}</span>
    </>
  )
}

function FileLabel({ data, comments, actions }: { data: TreeNode; comments: number; actions: ReactNode }) {
  const status = data.file?.status ?? FILE_STATUS.M
  return (
    <>
      <FileIcon path={data.path} size={TREE_ICON_PX} className="ml-[14px]" />
      <span className="min-w-0 flex-1 truncate" style={status === FILE_STATUS.D ? DELETED_NAME : undefined}>
        {data.name}
      </span>
      {comments > 0 ? (
        <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-[var(--act)]">
          <MessageSquare size={TREE_ICON_PX} aria-hidden />
          {comments}
        </span>
      ) : null}
      {actions}
      <StatusLetter status={status} />
    </>
  )
}

function RowLabel(props: { node: NodeRendererProps<TreeNode>['node']; comments: number; actions: ReactNode }) {
  const { node, comments, actions } = props
  if (node.data.kind === GROUP_KIND) return <GroupLabel node={node} actions={actions} />
  if (node.isInternal) return <DirLabel node={node} actions={actions} />
  return <FileLabel data={node.data} comments={comments} actions={actions} />
}

type OpenRowMenu = (e: MouseEvent<HTMLDivElement>, node: TreeNode) => void
/** What every row reads: comment counts, the context-menu opener, the inline handlers, "Open in editor". */
interface RowContextValue {
  counts: Record<string, number>
  openMenu: OpenRowMenu | null
  handlers?: RowHandlers
  onOpenInEditor?(path: string): void
}
const RowContext = createContext<RowContextValue>({ counts: NO_COUNTS, openMenu: null })

function InlineActions({ node }: { node: NodeRendererProps<TreeNode>['node'] }) {
  const { handlers, onOpenInEditor } = useContext(RowContext)
  if (!handlers) return null
  const open = onOpenInEditor ? () => onOpenInEditor(node.data.path) : undefined
  return <RowActions buttons={rowButtons(node.data, handlers, open)} visible={node.isSelected} />
}

/** One react-arborist row (group, directory or file). */
function ChangeRow({ node, style }: NodeRendererProps<TreeNode>) {
  const { counts, openMenu } = useContext(RowContext)
  const { data } = node
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the right-click menu repeats the diff header's button
    <div
      style={style}
      onContextMenu={openMenu && data.kind === FILE_KIND ? (e) => openMenu(e, data) : undefined}
      data-testid={T.treeRow}
      data-path={data.path}
      data-kind={data.kind}
      data-depth={node.level}
      data-status={data.file?.status}
      data-staged={data.staged || undefined}
      data-selected={node.isSelected || undefined}
      title={titleOf(data)}
      className={cn(
        'group flex h-full cursor-default select-none items-center gap-1 pr-2 text-[13px]',
        node.isSelected ? 'bg-[var(--hv)] text-[var(--tx)]' : 'hover:bg-[var(--hv)]',
      )}
    >
      <RowLabel node={node} comments={counts[data.path] ?? 0} actions={<InlineActions node={node} />} />
    </div>
  )
}

/** The compressed, indented changes tree (22px rows, 12px indent), single selection, keyboard via react-arborist. */
export function ChangesTree(props: ChangesTreeProps) {
  const { nodes, selectedPath, onSelect, commentCounts = NO_COUNTS, treeRef, onOpenInEditor, handlers } = props
  const t = useT()
  const [containerRef, height] = useContainerHeight()
  const [menuAt, setMenuAt] = useState<RowMenuAt | null>(null)
  const openMenu: OpenRowMenu = (e, node) => {
    e.preventDefault()
    const box = containerRef.current?.getBoundingClientRect()
    setMenuAt({ node, x: e.clientX - (box?.left ?? 0), y: e.clientY - (box?.top ?? 0) })
  }
  const hasMenu = onOpenInEditor !== undefined || handlers !== undefined
  const row: RowContextValue = { counts: commentCounts, openMenu: hasMenu ? openMenu : null, handlers, onOpenInEditor }
  return (
    <RowContext.Provider value={row}>
      <div ref={containerRef} data-testid={T.tree} className="relative h-full min-h-0 overflow-hidden">
        <Tree<TreeNode>
          ref={treeRef}
          data={nodes}
          idAccessor="id"
          childrenAccessor={(n) => n.children ?? null}
          openByDefault
          width="100%"
          height={height}
          rowHeight={TREE_ROW_HEIGHT_PX}
          indent={TREE_INDENT_PX}
          disableDrag
          disableDrop
          disableEdit
          disableMultiSelection
          selectionFollowsFocus
          selection={selectedPath ? FILE_ID_PREFIX + selectedPath : undefined}
          aria-label={t('git-changes:tree.label')}
          onSelect={(selected) => {
            const n = selected[0]
            if (n?.data.kind === FILE_KIND && n.data.file) onSelect(entryKey(n.data.file))
          }}
          onActivate={(n) => {
            if (n.isInternal) n.toggle()
          }}
        >
          {ChangeRow}
        </Tree>
        {hasMenu ? (
          <RowMenu at={menuAt} onClose={() => setMenuAt(null)} onOpenInEditor={onOpenInEditor} handlers={handlers} />
        ) : null}
      </div>
    </RowContext.Provider>
  )
}
