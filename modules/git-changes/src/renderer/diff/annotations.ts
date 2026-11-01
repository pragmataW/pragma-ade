import type { DiffLineAnnotation } from '@pierre/diffs/react'
import { type Comment, type CommentContext, DIFF_SIDE } from '@pragma/module-comments/contract'
import { toAnnotationSide } from '../lib/comments'
import type { DiffAnnotationMeta } from './diff-options'

type Anchor = Pick<CommentContext, 'filePath' | 'diffSide' | 'lineStart' | 'lineEnd'>

/** `DiffAnnotationMeta.kind` values. */
export const ANNOTATION_KIND = { comment: 'comment', composer: 'composer' } as const

/** True when the anchor points at this file on its side (the old side of a rename uses the old path). */
export const anchoredTo = (a: Anchor, file: { path: string; oldPath?: string }): boolean =>
  a.filePath === (a.diffSide === DIFF_SIDE.old ? (file.oldPath ?? file.path) : file.path)

const placed = (a: Anchor) => {
  const lineNumber = a.lineEnd ?? a.lineStart
  return lineNumber === undefined ? null : { side: toAnnotationSide(a.diffSide), lineNumber }
}

/** Comment cards under their last line, then the open composer (last). */
export function toAnnotations(
  comments: readonly Comment[],
  composer: CommentContext | null,
  file: { path: string; oldPath?: string },
): DiffLineAnnotation<DiffAnnotationMeta>[] {
  const out: DiffLineAnnotation<DiffAnnotationMeta>[] = []
  for (const comment of comments) {
    const at = anchoredTo(comment, file) ? placed(comment) : null
    if (at) out.push({ ...at, metadata: { kind: ANNOTATION_KIND.comment, comment } })
  }
  const at = composer && anchoredTo(composer, file) ? placed(composer) : null
  if (composer && at) out.push({ ...at, metadata: { kind: ANNOTATION_KIND.composer, context: composer } })
  return out
}
