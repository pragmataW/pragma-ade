import { COMMENTS_MODULE_ID } from '../../constants'
import { CLI_METHOD } from '../../contract'
import { type CliHandler, defineCliHandler } from '../lib/define-cli-handler'
import { requireService } from '../lib/require-service'
import { toCliComment } from '../mappers'
import { resolveWorktree } from '../resolve-context'
import type { CliHandlerDeps } from './types'

export function commentsHandlers(deps: CliHandlerDeps): Record<'commentsList', CliHandler> {
  return {
    commentsList: defineCliHandler(CLI_METHOD.commentsList, async (req) => {
      const comments = requireService(deps.comments, COMMENTS_MODULE_ID)
      const worktree = await resolveWorktree(deps.projects, req.worktreeId, req.context)
      return { worktreeId: worktree.id, comments: (await comments.listDrafts(worktree.id)).map(toCliComment) }
    }),
  }
}
