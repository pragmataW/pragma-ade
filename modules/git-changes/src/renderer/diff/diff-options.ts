import type { FileContents, FileDiffOptions, SelectedLineRange } from '@pierre/diffs/react'
import type { Comment, CommentContext } from '@pragma/module-comments/contract'
import type { ThemeMode } from '@pragma/sdk'
import {
  CHANGE_SCROLL_OFFSET_PX,
  DIFF_CONTEXT_LINES,
  DIFF_EXPANSION_LINES,
  DIFF_UNSAFE_CSS,
  HUNK_SEPARATORS,
  PIERRE_THEMES,
} from '../../constants'
import { type DiffStyle, FILE_VERSION_KIND, type FileDiffContents, type FileVersion } from '../../contract'

/** What a diff line annotation carries: a stored comment card or the open composer. */
export type DiffAnnotationMeta = { kind: 'comment'; comment: Comment } | { kind: 'composer'; context: CommentContext }

export const PLACEHOLDER_KINDS = [
  FILE_VERSION_KIND.tooLarge,
  FILE_VERSION_KIND.binary,
  FILE_VERSION_KIND.unreadable,
] as const
export type PlaceholderKind = (typeof PLACEHOLDER_KINDS)[number]
export interface PlaceholderInfo {
  kind: PlaceholderKind
  bytes?: number
}

/** The text side as `@pierre/diffs` input; every other kind renders no side. */
export const toFileContents = (name: string, v: FileVersion): FileContents | null =>
  v.kind === FILE_VERSION_KIND.text ? { name, contents: v.contents } : null

/**
 * A placeholder instead of the diff: tooLarge > binary > unreadable (either side), and unreadable when both sides
 * are absent. New and deleted text files are diffed one-sided.
 */
export function placeholderFor(c: FileDiffContents): PlaceholderInfo | null {
  const sides = [c.new, c.old]
  for (const kind of PLACEHOLDER_KINDS) {
    const side = sides.find((s) => s.kind === kind)
    if (side?.kind === FILE_VERSION_KIND.tooLarge) return { kind, bytes: side.bytes }
    if (side) return { kind }
  }
  return sides.every((s) => s.kind === FILE_VERSION_KIND.absent) ? { kind: FILE_VERSION_KIND.unreadable } : null
}

export interface DiffOptionsInput {
  diffStyle: DiffStyle
  showFullFile: boolean
  theme: ThemeMode
  /** A gutter "+" click or a finished line selection. */
  onRange(range: SelectedLineRange): void
}

export function buildDiffOptions({
  diffStyle,
  showFullFile,
  theme,
  onRange,
}: DiffOptionsInput): FileDiffOptions<DiffAnnotationMeta, undefined> {
  return {
    diffStyle,
    expandUnchanged: showFullFile,
    hunkSeparators: HUNK_SEPARATORS,
    expansionLineCount: DIFF_EXPANSION_LINES,
    parseDiffOptions: { context: DIFF_CONTEXT_LINES },
    theme: PIERRE_THEMES,
    themeType: theme,
    overflow: 'scroll',
    disableFileHeader: true,
    lineHoverHighlight: 'both',
    enableGutterUtility: true,
    onGutterUtilityClick: onRange,
    enableLineSelection: true,
    onLineSelectionEnd: (r) => {
      if (r) onRange(r)
    },
    unsafeCSS: DIFF_UNSAFE_CSS,
  }
}

const LINE_BREAK = /\r?\n/

/** 1-based line of the new text where it first differs from the old one (1 when equal or no old text). */
export function firstChangedLine(oldText: string | null, newText: string): number {
  if (oldText === null) return 1
  const a = oldText.split(LINE_BREAK)
  const b = newText.split(LINE_BREAK)
  const index = b.findIndex((line, i) => line !== a[i])
  return index < 0 ? 1 : index + 1
}

export const CHANGE_LINE_TYPES = ['change-addition', 'change-deletion'] as const
const isChange = (type: string | null | undefined): boolean =>
  (CHANGE_LINE_TYPES as readonly (string | null | undefined)[]).includes(type)

/** Indexes of the rows that start a contiguous run of changed rows. */
export const changeRunStarts = (lineTypes: readonly (string | null | undefined)[]): number[] =>
  lineTypes.flatMap((type, i) => (isChange(type) && !isChange(lineTypes[i - 1]) ? [i] : []))

export const CHANGE_DIRECTIONS = ['next', 'prev'] as const
export type ChangeDirection = (typeof CHANGE_DIRECTIONS)[number]

/** The run top to scroll to: the first below the viewport top (next) or the last above it (prev). */
export function nextChangeTop(tops: readonly number[], scrollTop: number, direction: ChangeDirection): number | null {
  const sorted = [...tops].sort((a, b) => a - b)
  if (direction === CHANGE_DIRECTIONS[0]) return sorted.find((t) => t > scrollTop + CHANGE_SCROLL_OFFSET_PX) ?? null
  return sorted.findLast((t) => t < scrollTop - CHANGE_SCROLL_OFFSET_PX) ?? null
}

const PATH_SEPARATOR = '/'
const RENAME_ARROW = ' → '

/**
 * The diff header's name in two parts: `head` (directories, and `old → ` for a rename) may be cut with an ellipsis in a
 * narrow pane; `base`, the file name, stays visible.
 */
export function headerName(path: string, oldPath?: string): { head: string; base: string } {
  const cut = path.lastIndexOf(PATH_SEPARATOR) + 1
  const rename = oldPath ? `${oldPath}${RENAME_ARROW}` : ''
  return { head: `${rename}${path.slice(0, cut)}`, base: path.slice(cut) }
}
