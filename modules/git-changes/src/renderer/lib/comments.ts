import type { AnnotationSide } from '@pierre/diffs/react'
import {
  COMMENT_SOURCE,
  COMMENT_STATUS,
  type Comment,
  CommentsUiServiceToken,
  commentsIpc,
  commentsIpcEvents,
  type DiffSide,
  type SendResult,
} from '@pragma/module-comments/contract'
import { useEffect } from 'react'
import { useKeyedLatest } from '../use-changes'
import { getRendererCtx } from './sdk'

/** `@pierre/diffs` side ↔ the comments DTO `diffSide` (05). */
export const SIDE_MAP = { additions: 'new', deletions: 'old' } as const satisfies Record<AnnotationSide, DiffSide>
export const ADDITIONS: AnnotationSide = 'additions'
const DELETIONS: AnnotationSide = 'deletions'

export const toDiffSide = (side: AnnotationSide): DiffSide => SIDE_MAP[side]
export const toAnnotationSide = (d: DiffSide | undefined): AnnotationSide =>
  d === SIDE_MAP.deletions ? DELETIONS : ADDITIONS

const NO_COMMENTS: Comment[] = []

/** The worktree's diff comments (drafts and sent), reloaded on `comments.changed` for that worktree. */
export function useDiffComments(worktreeId: string): Comment[] {
  const loaded = useKeyedLatest(worktreeId, async () => {
    const { ipc } = getRendererCtx()
    const [drafts, sent] = await Promise.all([
      ipc.invoke(commentsIpc.listDrafts, { worktreeId }),
      ipc.invoke(commentsIpc.listSent, { worktreeId }),
    ])
    return [...drafts, ...sent].filter((c) => c.source === COMMENT_SOURCE.diff)
  })
  const { reload } = loaded
  useEffect(() => {
    const sub = getRendererCtx().ipc.subscribe(commentsIpcEvents.changed, (p) => {
      if (p.worktreeId === worktreeId) reload()
    })
    return () => sub.dispose()
  }, [worktreeId, reload])
  return loaded.data ?? NO_COMMENTS
}

export const isDraft = (c: Comment): boolean => c.status === COMMENT_STATUS.draft

/** Draft count per file path (the tree's comment marker). */
export function draftCounts(comments: readonly Comment[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const c of comments) if (isDraft(c) && c.filePath) counts[c.filePath] = (counts[c.filePath] ?? 0) + 1
  return counts
}

/** Deletes the drafts through 05's IPC. */
export async function discardDiffDrafts(ids: readonly string[]): Promise<void> {
  const { ipc } = getRendererCtx()
  await Promise.all(ids.map((id) => ipc.invoke(commentsIpc.remove, { id })))
}

/** 05's send flow (target picker, start-agent prompt); undefined while a dialog waits for the user. */
export const sendDiffDrafts = (ids: string[]): Promise<SendResult | undefined> =>
  getRendererCtx().services.get(CommentsUiServiceToken).send(ids)
