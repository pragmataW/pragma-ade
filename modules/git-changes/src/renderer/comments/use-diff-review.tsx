import type { DiffLineAnnotation, SelectedLineRange } from '@pierre/diffs/react'
import type { Comment, CommentContext } from '@pragma/module-comments/contract'
import { type ReactNode, useCallback, useMemo } from 'react'
import { type ChangedFile, FILE_VERSION_KIND, type FileDiffContents, type FileVersion } from '../../contract'
import { ANNOTATION_KIND, anchoredTo, toAnnotations } from '../diff/annotations'
import type { DiffAnnotationMeta } from '../diff/diff-options'
import { toCommentContext } from '../diff/selection'
import { draftCounts, toAnnotationSide, useDiffComments } from '../lib/comments'
import { useGitChangesStore } from '../store'
import { CommentCard } from './CommentCard'
import { DiffCommentComposer } from './DiffCommentComposer'

const textOf = (v: FileVersion): string | null => (v.kind === FILE_VERSION_KIND.text ? v.contents : null)

export interface DiffReview {
  comments: Comment[]
  counts: Record<string, number>
  annotations: DiffLineAnnotation<DiffAnnotationMeta>[]
  composerRange: SelectedLineRange | null
  renderAnnotation(a: DiffLineAnnotation<DiffAnnotationMeta>): ReactNode
  onRange(range: SelectedLineRange, contents: FileDiffContents): void
}

/** Diff comments of the worktree wired to the diff: cards and composer as annotations, selection → composer. */
export function useDiffReview(
  worktreeId: string,
  file: ChangedFile | null,
  composer: CommentContext | null,
): DiffReview {
  const comments = useDiffComments(worktreeId)
  const counts = useMemo(() => draftCounts(comments), [comments])
  const annotations = useMemo(() => (file ? toAnnotations(comments, composer, file) : []), [comments, composer, file])
  const composerRange = useMemo((): SelectedLineRange | null => {
    if (!file || !composer || !anchoredTo(composer, file) || composer.lineStart === undefined) return null
    const side = toAnnotationSide(composer.diffSide)
    return { start: composer.lineStart, end: composer.lineEnd ?? composer.lineStart, side, endSide: side }
  }, [composer, file])
  const close = useCallback(() => useGitChangesStore.getState().closeComposer(worktreeId), [worktreeId])
  const renderAnnotation = useCallback(
    (a: DiffLineAnnotation<DiffAnnotationMeta>) =>
      a.metadata.kind === ANNOTATION_KIND.composer ? (
        <DiffCommentComposer worktreeId={worktreeId} context={a.metadata.context} onClose={close} />
      ) : (
        <CommentCard comment={a.metadata.comment} />
      ),
    [worktreeId, close],
  )
  const onRange = useCallback(
    (range: SelectedLineRange, c: FileDiffContents) => {
      const context = toCommentContext(range, { old: textOf(c.old), new: textOf(c.new) }, c)
      useGitChangesStore.getState().openComposer(worktreeId, context)
    },
    [worktreeId],
  )
  return { comments, counts, annotations, composerRange, renderAnnotation, onRange }
}
