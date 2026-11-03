import type { DiffFileInput, DiffLineAnnotation, FileDiffMetadata, SelectedLineRange } from '@pierre/diffs/react'
import { MultiFileDiff } from '@pierre/diffs/react'
import { type CommentContext, DIFF_SIDE } from '@pragma/module-comments/contract'
import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { ChevronDown, ChevronUp, SquareArrowOutUpRight } from '@pragma/ui/icons'
import { type ReactNode, type Ref, useImperativeHandle, useMemo, useRef } from 'react'
import { CHANGE_SCROLL_OFFSET_PX, DIFF_ICON_PX, SIZE_ICON_SM, VARIANT_GHOST } from '../../constants'
import {
  type ChangedFile,
  type ChangeMode,
  FILE_STATUS,
  FILE_VERSION_KIND,
  type FileDiffContents,
  type GitChangesSettings,
  GitChangesTestIds as T,
} from '../../contract'
import type { EditorOpener } from '../lib/editor'
import { useThemeMode } from '../lib/sdk'
import { useFileContents } from '../use-changes'
import {
  buildDiffOptions,
  CHANGE_DIRECTIONS,
  type ChangeDirection,
  changeRunStarts,
  type DiffAnnotationMeta,
  firstChangedLine,
  headerName,
  nextChangeTop,
  placeholderFor,
  toFileContents,
} from './diff-options'
import { FindBar, type FindBarHandle } from './FindBar'
import { Placeholder } from './Placeholder'
import { useRevealFocus } from './reveal-focus'

export interface DiffViewHandle {
  nextChange(): void
  prevChange(): void
  /** Cmd/Ctrl+F: open (or refocus) the find bar of this diff. */
  openFind(): void
}

export interface DiffViewProps {
  worktreeId: string
  mode: ChangeMode
  file: ChangedFile
  settings: GitChangesSettings
  ref?: Ref<DiffViewHandle>
  /** The open comment composer of this file, if any (its range stays highlighted). */
  composer?: CommentContext | null
  composerRange?: SelectedLineRange | null
  annotations?: DiffLineAnnotation<DiffAnnotationMeta>[]
  renderAnnotation?(annotation: DiffLineAnnotation<DiffAnnotationMeta>): ReactNode
  onRange?(range: SelectedLineRange, contents: FileDiffContents): void
  /** "Open in editor" (the file's git diff in the Files tab); absent without the editor module. */
  onOpenInEditor?: EditorOpener | null
  /** A file of this stash (its base ↔ the stash) instead of an entry of the change list. */
  stash?: string
  /** Shown between the header and the diff (the hunk actions of an uncommitted entry). */
  hunkBar?: ReactNode
}

const DIFFS_CONTAINER = 'diffs-container'
const LINE_TYPE_SELECTOR = '[data-line-type]'
const LINE_TYPE_ATTR = 'data-line-type'
const [NEXT, PREV] = CHANGE_DIRECTIONS
const NO_ANNOTATIONS: DiffLineAnnotation<DiffAnnotationMeta>[] = []

/** Tops (relative to the scroller) of the first row of every run of changed rows, per rendered column. */
function changeTops(scroller: HTMLElement): number[] {
  const root = scroller.querySelector(DIFFS_CONTAINER)?.shadowRoot
  if (!root) return []
  const columns = new Map<Element | null, Element[]>()
  for (const row of root.querySelectorAll(LINE_TYPE_SELECTOR)) {
    const rows = columns.get(row.parentElement) ?? []
    columns.set(row.parentElement, [...rows, row])
  }
  const origin = scroller.getBoundingClientRect().top - scroller.scrollTop
  return [...columns.values()].flatMap((rows) =>
    changeRunStarts(rows.map((r) => r.getAttribute(LINE_TYPE_ATTR))).map(
      (i) => (rows[i] as Element).getBoundingClientRect().top - origin,
    ),
  )
}

function jump(scroller: HTMLElement | null, direction: ChangeDirection): void {
  if (!scroller) return
  const top = nextChangeTop(changeTops(scroller), scroller.scrollTop, direction)
  if (top !== null) scroller.scrollTo({ top: top - CHANGE_SCROLL_OFFSET_PX })
}

const diffInput = (c: FileDiffContents): DiffFileInput | null => {
  const oldFile = toFileContents(c.oldPath ?? c.path, c.old)
  const newFile = toFileContents(c.path, c.new)
  if (oldFile && newFile) return { oldFile, newFile }
  if (newFile) return { oldFile: null, newFile }
  return oldFile ? { oldFile, newFile: null } : null
}

/** The line "Open in editor" lands on: the composer start (new side), else the first changed line, else 1. */
function editorLine(c: FileDiffContents | undefined, composer: CommentContext | null | undefined): number {
  if (composer?.diffSide === DIFF_SIDE.new && composer.lineStart) return composer.lineStart
  if (c?.new.kind !== FILE_VERSION_KIND.text) return 1
  return firstChangedLine(c.old.kind === FILE_VERSION_KIND.text ? c.old.contents : null, c.new.contents)
}

function OpenInEditor(props: { open(): void }) {
  const t = useT()
  const label = t('git-changes:diff.openInEditor')
  return (
    <Button
      size={SIZE_ICON_SM}
      variant={VARIANT_GHOST}
      data-testid={T.openInEditor}
      aria-label={label}
      title={label}
      onClick={props.open}
    >
      <SquareArrowOutUpRight size={DIFF_ICON_PX} aria-hidden />
    </Button>
  )
}

function DiffHeader(props: { file: ChangedFile; onJump(d: ChangeDirection): void; children: ReactNode }) {
  const t = useT()
  const { file } = props
  const { head, base } = headerName(file.path, file.status === FILE_STATUS.R ? file.oldPath : undefined)
  return (
    <div
      data-testid={T.diffHeader}
      className="flex h-9 shrink-0 items-center gap-2 border-[var(--bd)] border-b bg-[var(--pn)] px-2"
    >
      <span className="flex min-w-0 flex-1 overflow-hidden font-mono text-xs" title={`${head}${base}`}>
        {/* The directories are cut from the start (rtl box, ltr text: "…cs/"); the file name stays whole. */}
        {head ? (
          <span dir="rtl" className="min-w-[1ch] truncate">
            <bdi>{head}</bdi>
          </span>
        ) : null}
        <span className="max-w-full shrink-0 truncate">{base}</span>
      </span>
      <span className="shrink-0 font-mono text-xs">
        <span className="text-[var(--add-tx)]">{`+${file.additions}`}</span>{' '}
        <span className="text-[var(--del-tx)]">{`−${file.deletions}`}</span>
      </span>
      <Button
        size={SIZE_ICON_SM}
        variant={VARIANT_GHOST}
        data-testid={T.prevChange}
        aria-label={t('git-changes:diff.prevChange')}
        title={t('git-changes:diff.prevChange')}
        onClick={() => props.onJump(PREV)}
      >
        <ChevronUp size={DIFF_ICON_PX} aria-hidden />
      </Button>
      <Button
        size={SIZE_ICON_SM}
        variant={VARIANT_GHOST}
        data-testid={T.nextChange}
        aria-label={t('git-changes:diff.nextChange')}
        title={t('git-changes:diff.nextChange')}
        onClick={() => props.onJump(NEXT)}
      >
        <ChevronDown size={DIFF_ICON_PX} aria-hidden />
      </Button>
      {props.children}
    </div>
  )
}

function Banner({ c }: { c: FileDiffContents }) {
  const t = useT()
  const isNew = c.old.kind === FILE_VERSION_KIND.absent && c.new.kind === FILE_VERSION_KIND.text
  const isDeleted = c.new.kind === FILE_VERSION_KIND.absent && c.old.kind === FILE_VERSION_KIND.text
  if (!isNew && !isDeleted) return null
  return (
    <div className="border-[var(--bd)] border-b px-3 py-1 text-muted-foreground text-xs">
      {t(isNew ? 'git-changes:diff.newFile' : 'git-changes:diff.deletedFile')}
    </div>
  )
}

function DiffBody(props: DiffViewProps & { contents: FileDiffContents }) {
  const theme = useThemeMode()
  const { contents: c, onRange } = props
  const options = useMemo(
    () =>
      buildDiffOptions({
        diffStyle: props.settings.diffStyle,
        showFullFile: props.settings.showFullFile,
        theme,
        onRange: (r) => onRange?.(r, c),
      }),
    [props.settings.diffStyle, props.settings.showFullFile, theme, onRange, c],
  )
  const placeholder = placeholderFor(c)
  const input = diffInput(c)
  if (placeholder || !input)
    return (
      <Placeholder
        info={placeholder ?? { kind: FILE_VERSION_KIND.unreadable }}
        limitBytes={props.settings.maxFileBytes}
      />
    )
  return (
    <>
      <Banner c={c} />
      <MultiFileDiff<DiffAnnotationMeta>
        {...input}
        options={options}
        lineAnnotations={props.annotations ?? NO_ANNOTATIONS}
        renderAnnotation={
          props.renderAnnotation
            ? (a: DiffLineAnnotation<DiffAnnotationMeta>, _f: FileDiffMetadata) => props.renderAnnotation?.(a)
            : undefined
        }
        selectedLines={props.composerRange ?? null}
        className="gc-diff"
      />
    </>
  )
}

/** Header (path, +/−, change navigation, Open in editor) and the full-file diff or a placeholder. */
export function DiffView(props: DiffViewProps) {
  const t = useT()
  const { worktreeId, mode, file, ref, onOpenInEditor, stash } = props
  const loaded = useFileContents(worktreeId, mode, file, stash)
  const scroller = useRef<HTMLDivElement>(null)
  const findBar = useRef<FindBarHandle>(null)
  useRevealFocus(worktreeId, scroller, loaded.data !== undefined && stash === undefined)
  useImperativeHandle(ref, () => ({
    nextChange: () => jump(scroller.current, NEXT),
    prevChange: () => jump(scroller.current, PREV),
    openFind: () => findBar.current?.show(),
  }))
  const body = (() => {
    if (loaded.data) return <DiffBody {...props} contents={loaded.data} />
    const key = loaded.error === undefined ? 'git-changes:diff.loading' : 'git-changes:diff.loadFailed'
    return <div className="p-4 text-muted-foreground text-sm">{t(key)}</div>
  })()
  return (
    <div
      data-testid={T.diff}
      data-path={file.path}
      data-staged={file.staged || undefined}
      data-stash={stash}
      className="flex min-h-0 flex-1 flex-col"
    >
      <DiffHeader file={file} onJump={(d) => jump(scroller.current, d)}>
        {onOpenInEditor ? (
          <OpenInEditor open={() => onOpenInEditor(file, editorLine(loaded.data, props.composer))} />
        ) : null}
      </DiffHeader>
      <FindBar
        ref={findBar}
        scroller={scroller}
        contentKey={`${file.path}:${stash ?? ''}:${loaded.data ? 'loaded' : ''}`}
      />
      {props.hunkBar}
      <div ref={scroller} className="flex min-h-0 flex-1 flex-col overflow-auto">
        {body}
      </div>
    </div>
  )
}
