import { type Comment, SEND_STATUS, sendErrorI18nKey } from '@pragma/module-comments/contract'
import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { useState } from 'react'
import { ROLE_ALERT, SIZE_SM, VARIANT_GHOST } from '../../constants'
import { GitChangesTestIds as T } from '../../contract'
import { discardDiffDrafts, sendRound } from '../lib/comments'

const report = (what: string) => (e: unknown) => console.warn(`git-changes: ${what} failed`, e)

/** Floating bar while diff drafts exist: `N pending comments · file` · Discard (confirm) · Send N comments to agent. */
export function ReviewBar({ comments, fileName }: { comments: readonly Comment[]; fileName: string }) {
  const t = useT()
  const [confirming, setConfirming] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const ids = comments.map((c) => c.id)
  if (ids.length === 0) return null
  const count = ids.length
  const discard = () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setConfirming(false)
    discardDiffDrafts(ids).catch(report('discard'))
  }
  const send = async () => {
    setErrorKey(null)
    const result = await sendRound(comments[0]?.worktreeId as string)
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
      <Button size={SIZE_SM} variant={VARIANT_GHOST} data-testid={T.reviewDiscard} onClick={discard}>
        {confirming ? t('git-changes:review.confirmDiscard', { count }) : t('git-changes:review.discard')}
      </Button>
      <Button size={SIZE_SM} data-testid={T.reviewSend} onClick={() => void send().catch(report('send'))}>
        {t('git-changes:review.send', { count })}
      </Button>
    </div>
  )
}
