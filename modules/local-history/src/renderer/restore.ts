import type { RendererContext } from '@pragma/sdk/renderer'
import type { RestoreResult } from '../contract'

type Ctx = Pick<RendererContext, 'dialogs' | 'notifications'>

/** Restoring overwrites files; it is undoable (the current content is saved first), but it still asks. */
export const confirmRestore = (ctx: Ctx): Promise<boolean> =>
  ctx.dialogs.confirm({
    titleKey: 'local-history:confirm.restoreTitle',
    messageKey: 'local-history:confirm.restoreMessage',
    confirmKey: 'local-history:confirm.restoreConfirm',
  })

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
