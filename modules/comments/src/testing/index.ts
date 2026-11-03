/** Test builders for other modules' unit tests (`@pragma/module-comments/testing`); not loaded by the app. */
import type { Comment, CommentReply } from '../contract'

let seq = 0

/** An open, pending diff thread on `src/example.ts:1-2` without replies, unless overridden. */
export function aThread(over: Partial<Comment> = {}): Comment {
  seq += 1
  return {
    id: `c${seq}`,
    worktreeId: 'wt-1',
    source: 'diff',
    filePath: 'src/example.ts',
    lineStart: 1,
    lineEnd: 2,
    snippet: 'const a = 1\nconst b = 2',
    language: 'ts',
    body: 'Rename these.',
    status: 'open',
    replies: [],
    createdAt: seq,
    updatedAt: seq,
    ...over,
  }
}

/** A pending user reply to `c1`, unless overridden. */
export function aReply(over: Partial<CommentReply> = {}): CommentReply {
  seq += 1
  return { id: `r${seq}`, commentId: 'c1', author: 'user', body: 'Reply.', createdAt: seq, ...over }
}
