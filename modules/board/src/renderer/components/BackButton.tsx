import { useT } from '@pragma/sdk/renderer'
import { Icon } from '@pragma/ui/components/icon'
import { BACK_ICON, ICON_PX } from '../../constants'
import { BOARD_TESTIDS as T } from '../../contract'
import { leaveBoard } from '../lib/navigation'
import { PlainButton } from './PlainButton'

/** Top-left "← Back", the same control as the Settings view's: returns to the agents view. */
export function BackButton() {
  const t = useT()
  return (
    <PlainButton
      data-testid={T.back}
      onClick={leaveBoard}
      className="flex h-[var(--row-h)] items-center gap-1.5 rounded-[var(--radius-button)] px-2 text-[var(--mu)] hover:bg-[var(--hv)] hover:text-[var(--tx)]"
    >
      <Icon name={BACK_ICON} size={ICON_PX.row} />
      {t('board:view.back')}
    </PlainButton>
  )
}
