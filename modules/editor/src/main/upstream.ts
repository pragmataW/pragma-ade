import { type BridgeServer, BridgeServerToken } from '@pragma/module-bridge/contract'
import {
  type Comment,
  type CommentInput,
  type CommentStatus,
  CommentsServiceToken,
  commentsChanged,
  type ReplyInput,
  type SendResult,
} from '@pragma/module-comments/contract'
import {
  PROJECTS_COMMANDS,
  ProjectsServiceToken,
  worktreeRemoved,
  worktreeSelected,
} from '@pragma/module-projects/contract'
import type { MainContext } from '@pragma/sdk/main'
import { normalizeFolderKey } from '../contract'

export type WorktreeRef = { id: string; path: string }

/** Everything the editor needs from projects, bridge and comments; the only file touching their services. */
export interface EditorUpstream {
  getActiveWorktreeId(): string | null
  getWorktree(id: string): Promise<WorktreeRef | null>
  findWorktreeByFolderKey(key: string): Promise<WorktreeRef | null>
  onWorktreeSelected(cb: (worktreeId: string | null) => void): () => void
  onWorktreeRemoved(cb: (worktreeId: string) => void): () => void
  /** Command `projects.selectWorktree` (§10.3). */
  selectWorktree(worktreeId: string): Promise<void>
  bridge: Pick<BridgeServer, 'url' | 'token' | 'registerHandler' | 'broadcast' | 'send' | 'onClient'>
  addDraft(i: CommentInput): Promise<Comment>
  /** Sends the worktree's review round (every pending item); no target: the comments module asks the user. */
  send(worktreeId: string): Promise<SendResult>
  listThreads(worktreeId: string): Promise<Comment[]>
  reply(id: string, input: ReplyInput): Promise<Comment>
  setStatus(id: string, status: CommentStatus): Promise<Comment>
  remove(id: string): Promise<void>
  /** A pending user reply (the comments service refuses a delivered one). */
  removeReply(replyId: string): Promise<void>
  /** A worktree's threads were added, edited, replied to, resolved, deleted or delivered. */
  onCommentsChanged(cb: (worktreeId: string) => void): () => void
}

const ref = (w: { id: string; path: string; archivedAt?: number | null } | null): WorktreeRef | null =>
  w && !w.archivedAt ? { id: w.id, path: w.path } : null

export function createUpstream(ctx: MainContext): EditorUpstream {
  const projects = ctx.services.get(ProjectsServiceToken)
  const comments = ctx.services.get(CommentsServiceToken)
  const bridge = ctx.services.get(BridgeServerToken)
  return {
    getActiveWorktreeId: () => projects.getActiveWorktreeId(),
    getWorktree: async (id) => ref(await projects.getWorktree(id)),
    async findWorktreeByFolderKey(key) {
      const { worktrees } = await projects.getSnapshot()
      return ref(worktrees.find((w) => normalizeFolderKey(w.path) === key) ?? null)
    },
    onWorktreeSelected(cb) {
      const d = ctx.events.on(worktreeSelected, (p) => cb(p.worktreeId))
      return () => d.dispose()
    },
    onWorktreeRemoved(cb) {
      const d = ctx.events.on(worktreeRemoved, (p) => cb(p.worktreeId))
      return () => d.dispose()
    },
    selectWorktree: async (worktreeId) => {
      await ctx.commands.execute(PROJECTS_COMMANDS.selectWorktree, { worktreeId })
    },
    bridge,
    addDraft: (i) => comments.addDraft(i),
    send: (worktreeId) => comments.send(worktreeId),
    listThreads: (worktreeId) => comments.listThreads(worktreeId),
    reply: (id, input) => comments.reply(id, input),
    setStatus: (id, status) => comments.setStatus(id, status),
    remove: (id) => comments.remove(id),
    removeReply: (replyId) => comments.removeReply(replyId),
    onCommentsChanged(cb) {
      const d = ctx.events.on(commentsChanged, (p) => cb(p.worktreeId))
      return () => d.dispose()
    },
  }
}
