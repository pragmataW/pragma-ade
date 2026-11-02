import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { TriangleAlert, X } from '@pragma/ui/icons'
import { DIFF_ICON_PX, ROLE_ALERT, SIZE_ICON_SM, VARIANT_GHOST } from '../../constants'
import { GitChangesTestIds as T } from '../../contract'
import { useScmFeedback, useScmStore } from './scm-store'

/** The last failed operation: an i18n message for its code and git's own output; dismissable. */
export function ErrorBanner({ worktreeId }: { worktreeId: string }) {
  const t = useT()
  const { error } = useScmFeedback(worktreeId)
  if (!error) return null
  const dismiss = t('git-changes:scm.dismiss')
  return (
    <div
      data-testid={T.scmError}
      data-code={error.code}
      role={ROLE_ALERT}
      className="flex shrink-0 items-start gap-2 border-[var(--bd)] border-b bg-[var(--el)] px-2 py-1.5 text-xs"
    >
      <TriangleAlert size={DIFF_ICON_PX} className="mt-0.5 shrink-0 text-[var(--err)]" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-[var(--tx)]">{t(`git-changes:scm.errors.${error.code}`)}</div>
        {error.detail ? (
          <pre className="mt-0.5 max-h-24 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">
            {error.detail}
          </pre>
        ) : null}
      </div>
      <Button
        size={SIZE_ICON_SM}
        variant={VARIANT_GHOST}
        aria-label={dismiss}
        title={dismiss}
        onClick={() => useScmStore.getState().setError(worktreeId, null)}
      >
        <X size={DIFF_ICON_PX} aria-hidden />
      </Button>
    </div>
  )
}
