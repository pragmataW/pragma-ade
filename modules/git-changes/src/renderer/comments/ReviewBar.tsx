import {
  COMMENT_STATUS,
  type Comment,
  pendingCount,
  SEND_STATUS,
  sendErrorI18nKey,
} from '@pragma/module-comments/contract'
import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@pragma/ui/components/dropdown-menu'
import { Ellipsis } from '@pragma/ui/icons'
import { useState } from 'react'
import { DIFF_ICON_PX, REVIEW_BAR_NARROW_PX, ROLE_ALERT, SIZE_ICON_SM, SIZE_SM, VARIANT_GHOST } from '../../constants'
import { GitChangesTestIds as T } from '../../contract'
import { clearResolved, discardThreads, pendingDiffRoots, sendRound } from '../lib/comments'
import { useBarWidth } from './use-bar-width'

const report = (what: string) => (e: unknown) => console.warn(`git-changes: ${what} failed`, e)
const MENU_ALIGN = 'end'

interface BarProps {
  worktreeId: string
  /** Every thread of the worktree (editor and browser ones count as pending items too). */
  threads: readonly Comment[]
  fileName: string
}

/** Discard of the diff's unsent threads: the first click asks ("Discard N new? Click again"), the second discards. */
function useDiscard(threads: Comment[]) {
  const [confirming, setConfirming] = useState(false)
  return {
    count: threads.length,
    confirming,
    ask: () => setConfirming(true),
    click: () => {
      setConfirming(!confirming)
      if (confirming) discardThreads(threads).catch(report('discard'))
    },
  }
}
type Discard = ReturnType<typeof useDiscard>

function DiscardButton({ discard }: { discard: Discard }) {
  const t = useT()
  return (
    <Button size={SIZE_SM} variant={VARIANT_GHOST} data-testid={T.reviewDiscard} onClick={discard.click}>
      {discard.confirming
        ? t('git-changes:review.confirmDiscard', { count: discard.count })
        : t('git-changes:review.discard')}
    </Button>
  )
}

/** The narrow bar's "…": Discard (then confirmed inline in the bar) and Clear resolved. */
function MoreMenu({ discard, onClearResolved }: { discard: Discard; onClearResolved?: () => void }) {
  const t = useT()
  const label = t('git-changes:review.more')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={SIZE_ICON_SM} variant={VARIANT_GHOST} data-testid={T.reviewMore} aria-label={label} title={label}>
          <Ellipsis size={DIFF_ICON_PX} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={MENU_ALIGN}>
        {discard.count ? (
          <DropdownMenuItem data-testid={T.reviewDiscard} onSelect={discard.ask}>
            {t('git-changes:review.discard')}
          </DropdownMenuItem>
        ) : null}
        {onClearResolved ? (
          <DropdownMenuItem data-testid={T.reviewClearResolved} onSelect={onClearResolved}>
            {t('git-changes:review.clearResolved')}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Discard and Clear resolved: inline when wide; a "…" menu when narrow (a confirming Discard stays inline). */
function SecondaryActions(p: { narrow: boolean; discard: Discard; onClearResolved?: () => void }) {
  const t = useT()
  if (p.narrow)
    return (
      <>
        {p.discard.confirming ? <DiscardButton discard={p.discard} /> : null}
        {p.discard.count || p.onClearResolved ? (
          <MoreMenu discard={p.discard} onClearResolved={p.onClearResolved} />
        ) : null}
      </>
    )
  return (
    <>
      {p.discard.count ? <DiscardButton discard={p.discard} /> : null}
      {p.onClearResolved ? (
        <Button size={SIZE_SM} variant={VARIANT_GHOST} data-testid={T.reviewClearResolved} onClick={p.onClearResolved}>
          {t('git-changes:review.clearResolved')}
        </Button>
      ) : null}
    </>
  )
}

/**
 * Floating bar while the worktree has unsent items or resolved threads: `N unsent items · file` · Discard (the diff's
 * new threads, confirm) · Clear resolved · Send N to agent (the whole review round). It never wraps: below
 * REVIEW_BAR_NARROW_PX Discard and Clear resolved move into a "…" menu.
 */
export function ReviewBar({ worktreeId, threads, fileName }: BarProps) {
  const t = useT()
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [ref, width] = useBarWidth<HTMLDivElement>()
  const discard = useDiscard(pendingDiffRoots(threads))
  const count = pendingCount(threads)
  const resolved = threads.some((c) => c.status === COMMENT_STATUS.resolved)
  if (count === 0 && !resolved) return null
  const send = async () => {
    setErrorKey(null)
    const result = await sendRound(worktreeId)
    if (result?.status === SEND_STATUS.failed) setErrorKey(sendErrorI18nKey(result.errorKey))
  }
  const onClearResolved = resolved ? () => void clearResolved(worktreeId).catch(report('clear resolved')) : undefined
  return (
    <div
      ref={ref}
      data-testid={T.reviewBar}
      className="mx-3 mb-3 flex shrink-0 flex-nowrap items-center gap-1.5 rounded-[var(--radius-popover)] border border-[var(--bd2)] bg-[var(--el)] py-1.5 pr-1.5 pl-3 text-[13px] shadow-lg"
    >
      <span className="min-w-0 flex-1 truncate">{t('git-changes:review.pending', { count, file: fileName })}</span>
      {errorKey ? (
        <span role={ROLE_ALERT} className="min-w-0 truncate text-[var(--err)] text-xs" title={t(errorKey)}>
          {t(errorKey)}
        </span>
      ) : null}
      <SecondaryActions
        narrow={width !== null && width < REVIEW_BAR_NARROW_PX}
        discard={discard}
        onClearResolved={onClearResolved}
      />
      <Button
        size={SIZE_SM}
        data-testid={T.reviewSend}
        disabled={count === 0}
        className="shrink-0"
        onClick={() => void send().catch(report('send'))}
      >
        {t('git-changes:review.send', { count })}
      </Button>
    </div>
  )
}
