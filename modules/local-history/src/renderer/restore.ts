import type { ConfirmInput } from '@pragma/sdk'
import type { RendererContext } from '@pragma/sdk/renderer'
import { SHORT_SHA } from '../constants'
import type { EntrySummary, RestoreResult } from '../contract'

type Ctx = Pick<RendererContext, 'dialogs' | 'notifications'>

/**
 * What restoring this entry (or only `paths` of it) does, in words that stand alone: macOS shows only the message.
 * Files are overwritten (undoable: their current content is saved first); a stash goes back on the list and an undone
 * commit is redone, both without touching files.
 */
export function restoreQuestion(entry: EntrySummary, paths?: string[]): ConfirmInput {
  const [file] = paths ?? []
  if (paths?.length === 1 && file)
    return {
      titleKey: 'local-history:confirm.restoreTitle',
      messageKey: 'local-history:confirm.restoreFile',
      confirmKey: 'local-history:confirm.restoreConfirm',
      params: { file },
    }
  if (entry.fileCount > 0)
    return {
      titleKey: 'local-history:confirm.restoreTitle',
      messageKey: 'local-history:confirm.restoreFiles',
      confirmKey: 'local-history:confirm.restoreConfirm',
      params: { count: paths?.length ?? entry.fileCount },
    }
  if (entry.stashCount > 0)
    return {
      titleKey: 'local-history:confirm.stashTitle',
      messageKey: 'local-history:confirm.restoreStash',
      confirmKey: 'local-history:confirm.stashConfirm',
      params: { count: entry.stashCount },
    }
  return {
    titleKey: 'local-history:confirm.commitTitle',
    messageKey: 'local-history:confirm.restoreCommit',
    confirmKey: 'local-history:confirm.commitConfirm',
    params: { sha: entry.headSha?.slice(0, SHORT_SHA) ?? '' },
  }
}

export const confirmRestore = (ctx: Ctx, entry: EntrySummary, paths?: string[]): Promise<boolean> =>
  ctx.dialogs.confirm(restoreQuestion(entry, paths))

const FAILURE_KEYS = {
  notFound: 'local-history:failure.notFound',
  headMoved: 'local-history:failure.headMoved',
  gitUnavailable: 'local-history:failure.gitUnavailable',
  gitFailed: 'local-history:failure.gitFailed',
} as const

/** A failed restore is told to the user; a successful one shows in the files themselves. */
export function reportRestore(ctx: Ctx, result: RestoreResult): void {
  if (result.ok) return
  ctx.notifications.show({
    titleKey: 'local-history:tab.title',
    bodyKey: FAILURE_KEYS[result.reason],
    params: { detail: result.detail ?? '' },
  })
}
