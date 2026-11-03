import {
  COMMENT_STATUS,
  type Comment,
  CommentsError,
  type CommentsService,
  REPLY_AUTHOR,
  type ReplyInput,
  SEND_ERROR,
  visibleToAgent,
} from '@pragma/module-comments/contract'
import { COMMENTS_MODULE_ID } from '../../constants'
import { CLI_METHOD, type CliCallerContext, type CliRequest, type CliResult } from '../../contract'
import { type CliHandler, defineCliHandler } from '../lib/define-cli-handler'
import { requireService } from '../lib/require-service'
import { toCliComment } from '../mappers'
import type { CliHandlerDeps } from './types'

type ThreadMethod = 'commentsShow' | 'commentsReply' | 'commentsResolve' | 'commentsReopen'
type ThreadRequest = CliRequest<ThreadMethod>
/** What an action does to a delivered thread the agent can see. */
type ThreadAction<M extends ThreadMethod> = (
  comments: CommentsService,
  req: CliRequest<M>,
  thread: Comment,
) => Promise<Comment>

/** The calling agent as a reply author: its session id and profile name when `PRAGMA_SESSION_ID` was set. */
async function agentAuthor(deps: CliHandlerDeps, context: CliCallerContext): Promise<Omit<ReplyInput, 'body'>> {
  const author = { author: REPLY_AUTHOR.agent }
  if (!context.sessionId) return author
  const session = await deps.agents.getSession(context.sessionId)
  if (!session) return author
  const profile = session.profileId
    ? (await deps.agents.listProfiles()).find((p) => p.id === session.profileId)
    : undefined
  return { ...author, sessionId: session.id, ...(profile ? { authorLabel: deps.nameOf(profile) } : {}) }
}

async function agentReply(deps: CliHandlerDeps, req: ThreadRequest, body: string): Promise<ReplyInput> {
  return { ...(await agentAuthor(deps, req.context)), body }
}

/** A thread the agent may see (delivered); a pending draft is `not_found`, as if it did not exist yet. */
async function visibleThread(comments: CommentsService, id: string): Promise<Comment> {
  const thread = visibleToAgent(await comments.getThread(id))
  if (!thread) throw new CommentsError(SEND_ERROR.notFound)
  return thread
}

/** Shared shape: find the visible thread, run the action, answer with the visible result and its text. */
function threadAction<M extends ThreadMethod>(deps: CliHandlerDeps, method: M, action: ThreadAction<M>): CliHandler {
  return defineCliHandler(method, async (req) => {
    const comments = requireService(deps.comments, COMMENTS_MODULE_ID)
    const before = await visibleThread(comments, req.commentId)
    const after = visibleToAgent(await action(comments, req, before)) ?? before
    const round = await comments.round(after.worktreeId)
    // every thread method answers one `CliComment`
    return toCliComment(after, comments.format([after], { round })) as CliResult<M>
  })
}

export function commentThreadHandlers(deps: CliHandlerDeps): Record<ThreadMethod, CliHandler> {
  const closing = async (req: CliRequest<'commentsResolve'>) =>
    req.body === undefined ? undefined : agentReply(deps, req, req.body)
  return {
    commentsShow: threadAction(deps, CLI_METHOD.commentsShow, async (_c, _req, thread) => thread),
    commentsReply: threadAction(deps, CLI_METHOD.commentsReply, async (c, req, thread) =>
      c.reply(thread.id, await agentReply(deps, req, req.body ?? req.document ?? '')),
    ),
    commentsResolve: threadAction(deps, CLI_METHOD.commentsResolve, async (c, req, thread) =>
      c.setStatus(thread.id, COMMENT_STATUS.resolved, await closing(req)),
    ),
    commentsReopen: threadAction(deps, CLI_METHOD.commentsReopen, async (c, _req, thread) =>
      c.setStatus(thread.id, COMMENT_STATUS.open),
    ),
  }
}
