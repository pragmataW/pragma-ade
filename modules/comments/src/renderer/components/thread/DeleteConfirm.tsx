import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { COMMENTS_TESTIDS as T } from '../../../contract'
import { QuietButton, SIZE_XS } from '../../lib/buttons'

const ROLE_ALERT = 'alert'

/** "Delete this thread?" Delete · Cancel, inline under the thread's header. */
export function DeleteConfirm({ onConfirm, onCancel }: { onConfirm(): void; onCancel(): void }) {
  const t = useT()
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5 rounded-[var(--radius-button)] border border-[var(--err)]/40 bg-[var(--err)]/8 px-2 py-1 text-[12px]">
      <span className="mr-auto text-foreground">{t('comments:thread.confirmDelete')}</span>
      <QuietButton data-testid={T.threadDeleteCancel} size={SIZE_XS} className="px-2 text-xs" onClick={onCancel}>
        {t('comments:thread.deleteCancel')}
      </QuietButton>
      <Button
        data-testid={T.threadDeleteConfirm}
        size={SIZE_XS}
        variant="destructive"
        autoFocus
        className="px-2 text-xs"
        onClick={onConfirm}
      >
        {t('comments:thread.deleteConfirm')}
      </Button>
    </div>
  )
}

export function DeleteFailed() {
  const t = useT()
  return (
    <p role={ROLE_ALERT} className="text-[12px] text-[var(--err)]">
      {t('comments:thread.deleteFailed')}
    </p>
  )
}
