import type { AnnotationSide } from '@pierre/diffs/react'
import {
  COMMENT_SOURCE,
  COMMENT_STATUS,
  type Comment,
  CommentsUiServiceToken,
  commentsIpc,
  commentsIpcEvents,
  type DiffSide,
  isCodeThread,
  isPendingRoot,
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

const NO_THREADS: Comment[] = []

/** Every review thread of the worktree (any source, any status), reloaded on `comments.changed` for that worktree. */
export function useWorktreeThreads(worktreeId: string): Comment[] {
  const loaded = useKeyedLatest(worktreeId, async () => {
    const { threads } = await getRendererCtx().ipc.invoke(commentsIpc.list, { worktreeId })
    return threads
  })
  const { reload } = loaded
  useEffect(() => {
    const sub = getRendererCtx().ipc.subscribe(commentsIpcEvents.changed, (p) => {
      if (p.worktreeId === worktreeId) reload()
    })
    return () => sub.dispose()
  }, [worktreeId, reload])
  return loaded.data ?? NO_THREADS
}

/** Threads the diff shows: every diff comment and the editor's threads (on the new side of their file). */
export const codeThreads = (threads: readonly Comment[]): Comment[] =>
  threads.filter((c) => c.source === COMMENT_SOURCE.diff || isCodeThread(c))

/** Open code threads per file path (the tree's comment marker). */
export function openCounts(threads: readonly Comment[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const c of codeThreads(threads))
    if (c.filePath && c.status === COMMENT_STATUS.open) counts[c.filePath] = (counts[c.filePath] ?? 0) + 1
  return counts
}

/** The diff's own unsent threads (what Discard deletes). */
export const pendingDiffRoots = (threads: readonly Comment[]): Comment[] =>
  threads.filter((c) => c.source === COMMENT_SOURCE.diff && isPendingRoot(c))

/** Deletes the threads through 05's IPC. */
export async function discardThreads(threads: readonly Comment[]): Promise<void> {
  const { ipc } = getRendererCtx()
  await Promise.all(threads.map((c) => ipc.invoke(commentsIpc.remove, { id: c.id })))
}

const ui = () => getRendererCtx().services.get(CommentsUiServiceToken)

/** 05's send flow for the worktree's whole review round (target picker, start-agent prompt); undefined while a dialog waits. */
export const sendRound = (worktreeId: string): Promise<SendResult | undefined> => ui().send({ worktreeId })

/** 05's "Clear resolved" (asks first); resolves to how many were deleted. */
export const clearResolved = (worktreeId: string): Promise<number> => ui().clearResolved(worktreeId)
