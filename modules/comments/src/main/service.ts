import type { MainContext } from '@pragma/sdk/main'
import {
  COMMENT_STATUS,
  type Comment,
  CommentInputSchema,
  CommentsError,
  type CommentsService,
  type CommentsSettings,
  commentCreated,
  commentReplied,
  commentSent,
  commentStatusChanged,
  commentsChanged,
  commentsIpcEvents,
  isPendingReply,
  isPendingRoot,
  type ListThreadsFilter,
  type PendingItems,
  pendingItems,
  REPLY_AUTHOR,
  type ReplyInput,
  ReplyInputSchema,
  SEND_ERROR,
  SEND_STATUS,
  type SendErrorKey,
  type SendResult,
  TARGET_KIND,
  type TargetResolution,
  visibleToAgent,
} from '../contract'
import type { DeliveryRegistry } from './delivery-registry'
import { formatNudge, formatThreads } from './format'
import { PendingDeliveries, type PendingOptions } from './pending'
import type { CommentsRepository } from './repository'
import { type CommentsUpstream, isRunning, type SessionRef, toTargetSession } from './upstream'

export interface ServiceDeps {
  repo: CommentsRepository
  upstream: CommentsUpstream
  registry: DeliveryRegistry
  events: Pick<MainContext['events'], 'emit'>
  settings: () => CommentsSettings
  now?: () => number
  pendingOptions?: PendingOptions
}

/** One review round about to be delivered: the pending ids captured now and the threads they belong to. */
type Round = { worktreeId: string; round: number; items: PendingItems; threads: Comment[]; text: string }

const failed = (errorKey: SendErrorKey, message?: string): SendResult => ({
  status: SEND_STATUS.failed,
  errorKey,
  message,
})

/** Threads with an item in `items`, and the nudge counts. Undefined when nothing is pending. */
function collectRound(repo: CommentsRepository, worktreeId: string): Round | undefined {
  const all = repo.list(worktreeId)
  const items = pendingItems(all)
  const replyIds = new Set(items.replyIds)
  const created = new Set(items.commentIds)
  const updated = all.filter((c) => !created.has(c.id) && c.replies.some((r) => replyIds.has(r.id)))
  if (!created.size && !updated.length) return undefined
  const threads = all.filter((c) => created.has(c.id) || updated.includes(c))
  const inRound = new Set(threads.map((c) => c.id))
  const open = all.filter((c) => c.status === COMMENT_STATUS.open || inRound.has(c.id)).length
  const round = repo.currentRound(worktreeId) + 1
  const text = formatNudge({ round, open, created: created.size, updated: updated.length })
  return { worktreeId, round, items, threads, text }
}

/** Running sessions → none | single | choose (default: preferred, else last focused, else the first). */
async function resolveFor(
  upstream: CommentsUpstream,
  worktreeId: string,
  preferredSessionId?: string,
): Promise<TargetResolution> {
  const running = (await upstream.listSessions(worktreeId)).filter(isRunning)
  const [first] = running
  if (!first) return { kind: TARGET_KIND.none }
  if (running.length === 1) return { kind: TARGET_KIND.single, session: toTargetSession(first) }
  const isCandidate = (s: SessionRef | undefined) => s !== undefined && running.some((r) => r.id === s.id)
  const preferred = running.find((s) => s.id === preferredSessionId)
  const lastFocused = preferred ? undefined : await upstream.lastFocusedSession(worktreeId)
  const chosen = preferred ?? (isCandidate(lastFocused) ? lastFocused : first) ?? first
  return { kind: TARGET_KIND.choose, sessions: running.map(toTargetSession), defaultSessionId: chosen.id }
}

export type CommentsServiceImpl = CommentsService & {
  setPendingOptions(opts: PendingOptions): void
  dispose(): void
}

export function createCommentsService(deps: ServiceDeps): CommentsServiceImpl {
  const { repo, upstream, registry, events } = deps
  const now = deps.now ?? Date.now
  const inFlight = new Set<string>()
  const notifyChanged = (worktreeId: string) => {
    events.emit(commentsChanged, { worktreeId })
    upstream.publish(commentsIpcEvents.changed, { worktreeId })
  }

  const getOrThrow = (id: string): Comment => {
    const c = repo.get(id)
    if (!c) throw new CommentsError(SEND_ERROR.notFound)
    return c
  }

  /** Stores a reply: agent replies carry the current round (never pending), user replies wait for a Send. */
  const insertReply = (thread: Comment, input: ReplyInput) => {
    const parsed = ReplyInputSchema.parse(input)
    const round = parsed.author === REPLY_AUTHOR.agent ? repo.currentRound(thread.worktreeId) : undefined
    const reply = repo.insertReply({ ...parsed, commentId: thread.id, round, createdAt: now() })
    events.emit(commentReplied, { comment: getOrThrow(thread.id), reply })
    return reply
  }

  function listThreads(worktreeId: string, filter: ListThreadsFilter = {}): Comment[] {
    const threads = repo.list(worktreeId, filter.status)
    if (!filter.deliveredOnly) return threads
    return threads.flatMap((c) => visibleToAgent(c) ?? [])
  }

  async function deliverTo(r: Round, sessionId: string): Promise<SendResult> {
    const session = await upstream.getSession(sessionId)
    if (!session || !isRunning(session)) return failed(SEND_ERROR.sessionNotRunning)
    if (session.worktreeId !== r.worktreeId) return failed(SEND_ERROR.wrongWorktree)
    const deliver = registry.get(session.mode)
    if (!deliver) return failed(SEND_ERROR.noDeliveryTarget)
    try {
      await deliver({
        sessionId,
        worktreeId: r.worktreeId,
        mode: session.mode,
        ptyId: session.ptyId,
        round: r.round,
        text: r.text,
        comments: r.threads,
        submit: deps.settings().submitAfterPaste,
      })
    } catch (e) {
      return e instanceof CommentsError ? failed(e.key) : failed(SEND_ERROR.deliveryFailed, String(e))
    }
    const sentAt = now()
    // Only the items captured before delivery; anything written meanwhile stays pending for the next round.
    const round = repo.markDelivered(r.worktreeId, r.items, sentAt)
    const delivered = { round, commentIds: r.items.commentIds, replyIds: r.items.replyIds, sessionId, sentAt }
    events.emit(commentSent, { ...delivered, worktreeId: r.worktreeId })
    notifyChanged(r.worktreeId)
    return { status: SEND_STATUS.sent, ...delivered }
  }

  async function sendRound(r: Round, target: string | undefined, promptUser: boolean): Promise<SendResult> {
    if (target) return deliverTo(r, target)
    const resolution = await resolveFor(upstream, r.worktreeId)
    if (resolution.kind === TARGET_KIND.single) return deliverTo(r, resolution.session.id)
    const result: SendResult =
      resolution.kind === TARGET_KIND.none
        ? { status: SEND_STATUS.noSession }
        : {
            status: SEND_STATUS.needsTarget,
            sessions: resolution.sessions,
            defaultSessionId: resolution.defaultSessionId,
          }
    if (promptUser) upstream.publish(commentsIpcEvents.sendRequested, { worktreeId: r.worktreeId, result })
    return result
  }

  const service: CommentsServiceImpl = {
    async addDraft(input) {
      const parsed = CommentInputSchema.parse(input)
      const comment = repo.insert({ ...parsed, createdAt: now() })
      events.emit(commentCreated, { comment })
      notifyChanged(comment.worktreeId)
      return comment
    },
    async update(id, patch) {
      if (!isPendingRoot(getOrThrow(id))) throw new CommentsError(SEND_ERROR.alreadyDelivered)
      const updated = repo.update(id, patch, now())
      if (!updated) throw new CommentsError(SEND_ERROR.notFound)
      notifyChanged(updated.worktreeId)
      return updated
    },
    async remove(id) {
      const c = getOrThrow(id)
      repo.remove(id)
      notifyChanged(c.worktreeId)
    },
    listThreads: async (worktreeId, filter) => listThreads(worktreeId, filter),
    getThread: async (id) => getOrThrow(id),
    async reply(id, input) {
      const thread = getOrThrow(id)
      const reply = insertReply(thread, input)
      if (reply.author === REPLY_AUTHOR.user) repo.reopen([id], now())
      notifyChanged(thread.worktreeId)
      return getOrThrow(id)
    },
    async removeReply(replyId) {
      const reply = repo.getReply(replyId)
      if (!reply) throw new CommentsError(SEND_ERROR.notFound)
      if (!isPendingReply(reply)) throw new CommentsError(SEND_ERROR.alreadyDelivered)
      const thread = getOrThrow(reply.commentId)
      repo.removeReply(replyId)
      notifyChanged(thread.worktreeId)
    },
    async setStatus(id, status, reply) {
      const thread = getOrThrow(id)
      if (reply) insertReply(thread, reply)
      const comment = repo.setStatus(id, status, now()) ?? getOrThrow(id)
      events.emit(commentStatusChanged, { comment })
      notifyChanged(thread.worktreeId)
      return comment
    },
    async clearResolved(worktreeId) {
      const ids = repo.clearResolved(worktreeId)
      if (ids.length) notifyChanged(worktreeId)
      return ids.length
    },
    round: async (worktreeId) => repo.currentRound(worktreeId),
    resolveTarget: (worktreeId, preferredSessionId) => resolveFor(upstream, worktreeId, preferredSessionId),
    async send(worktreeId, targetSessionId, opts) {
      if (inFlight.has(worktreeId)) return failed(SEND_ERROR.alreadySending)
      const r = collectRound(repo, worktreeId)
      if (!r) return failed(SEND_ERROR.empty)
      inFlight.add(worktreeId)
      try {
        return await sendRound(r, targetSessionId, opts?.promptUser !== false)
      } finally {
        inFlight.delete(worktreeId)
      }
    },
    sendOnNextSession: async (worktreeId) => ({ pendingId: pending.add(worktreeId) }),
    cancelPending: (worktreeId) => pending.cancel(worktreeId),
    format: (threads, opts) => formatThreads(threads, opts),
    registerDeliveryTarget: (mode, deliver) => registry.register(mode, deliver),
    setPendingOptions: (opts) => pending.setOptions(opts),
    dispose() {
      offRemoved()
      pending.dispose()
    },
  }
  const pending = new PendingDeliveries(
    upstream,
    service.send,
    (worktreeId, result) => upstream.publish(commentsIpcEvents.pendingDelivered, { worktreeId, result }),
    deps.pendingOptions,
  )
  const offRemoved = upstream.onWorktreeRemoved((worktreeId) => {
    repo.removeByWorktree(worktreeId)
    pending.cancel(worktreeId)
    notifyChanged(worktreeId)
  })
  return service
}
