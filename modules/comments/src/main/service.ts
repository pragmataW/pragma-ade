import type { MainContext } from '@pragma/sdk/main'
import {
  type Comment,
  CommentInputSchema,
  CommentsError,
  type CommentsService,
  type CommentsSettings,
  commentCreated,
  commentSent,
  commentsChanged,
  commentsIpcEvents,
  SEND_ERROR,
  SEND_STATUS,
  type SendErrorKey,
  type SendResult,
  TARGET_KIND,
  type TargetResolution,
} from '../contract'
import type { DeliveryRegistry } from './delivery-registry'
import { formatComments } from './format'
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

type Batch = { comments: Comment[]; worktreeId: string; ids: string[] }

const failed = (errorKey: SendErrorKey, message?: string): SendResult => ({
  status: SEND_STATUS.failed,
  errorKey,
  message,
})
const byCreatedAt = (a: Comment, b: Comment): number => a.createdAt - b.createdAt

/** The first validation failure of a send, or the batch it covers. */
function validate(repo: CommentsRepository, ids: string[], inFlight: ReadonlySet<string>): Batch | SendErrorKey {
  if (!ids.length) return SEND_ERROR.empty
  const comments = repo.getMany(ids)
  if (comments.length !== ids.length) return SEND_ERROR.notFound
  const worktrees = new Set(comments.map((c) => c.worktreeId))
  if (worktrees.size > 1) return SEND_ERROR.mixedWorktrees
  if (ids.some((id) => inFlight.has(id))) return SEND_ERROR.alreadySending
  return { comments, worktreeId: comments[0]?.worktreeId as string, ids }
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

  async function deliverTo(batch: Batch, sessionId: string): Promise<SendResult> {
    const session = await upstream.getSession(sessionId)
    if (!session || !isRunning(session)) return failed(SEND_ERROR.sessionNotRunning)
    if (session.worktreeId !== batch.worktreeId) return failed(SEND_ERROR.wrongWorktree)
    const deliver = registry.get(session.mode)
    if (!deliver) return failed(SEND_ERROR.noDeliveryTarget)
    const comments = [...batch.comments].sort(byCreatedAt)
    try {
      await deliver({
        sessionId,
        worktreeId: batch.worktreeId,
        mode: session.mode,
        ptyId: session.ptyId,
        text: formatComments(comments),
        comments,
        submit: deps.settings().submitAfterPaste,
      })
    } catch (e) {
      return e instanceof CommentsError ? failed(e.key) : failed(SEND_ERROR.deliveryFailed, String(e))
    }
    const sentAt = now()
    // Delivered comments are not kept; every non-`sent` result above leaves them as drafts.
    repo.removeMany(batch.ids)
    events.emit(commentSent, { commentIds: batch.ids, sessionId, worktreeId: batch.worktreeId, sentAt })
    notifyChanged(batch.worktreeId)
    return { status: SEND_STATUS.sent, sessionId, commentIds: batch.ids, sentAt }
  }

  async function sendBatch(batch: Batch, target: string | undefined, promptUser: boolean): Promise<SendResult> {
    if (target) return deliverTo(batch, target)
    const resolution = await resolveFor(upstream, batch.worktreeId)
    if (resolution.kind === TARGET_KIND.single) return deliverTo(batch, resolution.session.id)
    const result: SendResult =
      resolution.kind === TARGET_KIND.none
        ? { status: SEND_STATUS.noSession }
        : {
            status: SEND_STATUS.needsTarget,
            sessions: resolution.sessions,
            defaultSessionId: resolution.defaultSessionId,
          }
    if (promptUser)
      upstream.publish(commentsIpcEvents.sendRequested, { worktreeId: batch.worktreeId, commentIds: batch.ids, result })
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
      getOrThrow(id)
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
    listDrafts: async (worktreeId) => repo.list(worktreeId),
    resolveTarget: (worktreeId, preferredSessionId) => resolveFor(upstream, worktreeId, preferredSessionId),
    async send(commentIds, targetSessionId, opts) {
      const ids = [...new Set(commentIds)]
      const batch = validate(repo, ids, inFlight)
      if (typeof batch === 'string') return failed(batch)
      for (const id of ids) inFlight.add(id)
      try {
        return await sendBatch(batch, targetSessionId, opts?.promptUser !== false)
      } finally {
        for (const id of ids) inFlight.delete(id)
      }
    },
    sendOnNextSession: async (worktreeId, commentIds) => ({ pendingId: pending.add(worktreeId, commentIds) }),
    cancelPending: (worktreeId) => pending.cancel(worktreeId),
    format: (comments) => formatComments(comments),
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
