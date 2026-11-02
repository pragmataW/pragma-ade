import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { ROLE_ALERT, SIZE, VARIANT } from '../../constants'
import { setError, useBoardStore } from '../store'

/** The last failed action, dismissible. */
export function ErrorBanner() {
  const t = useT()
  const error = useBoardStore((s) => s.error)
  if (!error) return null
  return (
    <div
      role={ROLE_ALERT}
      className="flex items-center gap-2 border-b border-[var(--bd)] bg-[var(--pn)] px-3 py-1 text-[12px] text-[var(--err)]"
    >
      <span className="flex-1">{t('board:error.generic', { message: error })}</span>
      <Button variant={VARIANT.ghost} size={SIZE.xs} onClick={() => setError(null)}>
        {t('board:error.dismiss')}
      </Button>
    </div>
  )
}
