import {
  COMMENT_STATUS,
  type Comment,
  pendingCount,
  SEND_STATUS,
  sendErrorI18nKey,
} from '@pragma/module-comments/contract'
import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { useState } from 'react'
import { ROLE_ALERT, SIZE_SM, VARIANT_GHOST } from '../../constants'
import { GitChangesTestIds as T } from '../../contract'
import { clearResolved, discardThreads, pendingDiffRoots, sendRound } from '../lib/comments'

const report = (what: string) => (e: unknown) => console.warn(`git-changes: ${what} failed`, e)

interface BarProps {
  worktreeId: string
  /** Every thread of the worktree (editor and browser ones count as pending items too). */
  threads: readonly Comment[]
  fileName: string
}

/** Discard of the diff's unsent threads; click once more to confirm. */
function DiscardButton({ threads }: { threads: Comment[] }) {
  const t = useT()
  const [confirming, setConfirming] = useState(false)
  const count = threads.length
  if (!count) return null
  const discard = () => {
    setConfirming(!confirming)
    if (confirming) discardThreads(threads).catch(report('discard'))
  }
  return (
    <Button size={SIZE_SM} variant={VARIANT_GHOST} data-testid={T.reviewDiscard} onClick={discard}>
      {confirming ? t('git-changes:review.confirmDiscard', { count }) : t('git-changes:review.discard')}
    </Button>
  )
}

/**
 * Floating bar while the worktree has unsent items or resolved threads: `N unsent items · file` · Discard (the diff's
 * new threads, confirm) · Clear resolved · Send N to agent (the whole review round).
 */
export function ReviewBar({ worktreeId, threads, fileName }: BarProps) {
  const t = useT()
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const count = pendingCount(threads)
  const resolved = threads.some((c) => c.status === COMMENT_STATUS.resolved)
  if (count === 0 && !resolved) return null
  const send = async () => {
    setErrorKey(null)
    const result = await sendRound(worktreeId)
    if (result?.status === SEND_STATUS.failed) setErrorKey(sendErrorI18nKey(result.errorKey))
  }
  return (
    <div
      data-testid={T.reviewBar}
      className="mx-3 mb-3 flex shrink-0 flex-wrap items-center gap-2 rounded-[var(--radius-popover)] border border-[var(--bd2)] bg-[var(--el)] px-3 py-2 text-[13px] shadow-lg"
    >
      <span className="min-w-0 flex-1 truncate">{t('git-changes:review.pending', { count, file: fileName })}</span>
      {errorKey ? (
        <span role={ROLE_ALERT} className="text-[var(--err)] text-xs">
          {t(errorKey)}
        </span>
      ) : null}
      <DiscardButton threads={pendingDiffRoots(threads)} />
      {resolved ? (
        <Button
          size={SIZE_SM}
          variant={VARIANT_GHOST}
          data-testid={T.reviewClearResolved}
          onClick={() => void clearResolved(worktreeId).catch(report('clear resolved'))}
        >
          {t('git-changes:review.clearResolved')}
        </Button>
      ) : null}
      <Button
        size={SIZE_SM}
        data-testid={T.reviewSend}
        disabled={count === 0}
        onClick={() => void send().catch(report('send'))}
      >
        {t('git-changes:review.send', { count })}
      </Button>
    </div>
  )
}
