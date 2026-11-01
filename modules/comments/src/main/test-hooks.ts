import { defineTestHooks } from '@pragma/sdk/main'
import { COMMENT_SOURCE, type Comment, type CommentInput } from '../contract'
import type { PendingOptions } from './pending'
import { getMainService } from './runtime'
import type { CommentsServiceImpl } from './service'

/** A diff comment on `src/example.ts:1-2` unless overridden. */
const DRAFT_DEFAULTS = {
  source: COMMENT_SOURCE.diff,
  filePath: 'src/example.ts',
  lineStart: 1,
  lineEnd: 2,
  snippet: 'const a = 1\nconst b = 2',
  language: 'ts',
  body: 'Test comment.',
} as const

/** `globalThis.__pragmaCommentsTest`, installed only when `PRAGMA_TEST=1` (§8). */
export interface CommentsTestHooks {
  /** A draft from a fake source, through `addDraft`. */
  createDraft(input: Partial<CommentInput> & { worktreeId: string }): Promise<Comment>
  setPendingOptions(opts: PendingOptions): void
}
export type CommentsTestGlobal = { __pragmaCommentsTest: CommentsTestHooks }

export function createCommentsTestHooks(service: CommentsServiceImpl): CommentsTestHooks {
  return {
    createDraft: (input) => service.addDraft({ ...DRAFT_DEFAULTS, ...input }),
    setPendingOptions: (opts) => service.setPendingOptions(opts),
  }
}

export default defineTestHooks(() => {
  ;(globalThis as unknown as CommentsTestGlobal).__pragmaCommentsTest = createCommentsTestHooks(getMainService())
})
