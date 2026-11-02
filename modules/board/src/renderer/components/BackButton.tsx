import { useT } from '@pragma/sdk/renderer'
import { Icon } from '@pragma/ui/components/icon'
import { BACK_ICON, ICON_PX } from '../../constants'
import { BOARD_TESTIDS as T } from '../../contract'
import { runAction } from '../lib/actions'
import { leaveBoard } from '../lib/navigation'
import { PlainButton } from './PlainButton'

/** "← Back" at the header's far left, the Settings view's control (ui-notes 6b): back to the previous view. */
export function BackButton() {
  const t = useT()
  return (
    <PlainButton
      data-testid={T.back}
      onClick={() => runAction(leaveBoard())}
      className="flex h-[var(--row-h)] shrink-0 items-center gap-1.5 rounded-[var(--radius-button)] px-2 text-[var(--mu)] hover:bg-[var(--hv)] hover:text-[var(--tx)]"
    >
      <Icon name={BACK_ICON} size={ICON_PX.row} />
      {t('board:view.back')}
    </PlainButton>
  )
}
