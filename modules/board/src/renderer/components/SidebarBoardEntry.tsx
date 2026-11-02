import { useT } from '@pragma/sdk/renderer'
import { Icon } from '@pragma/ui/components/icon'
import { ICON_PX, VIEW_ICON } from '../../constants'
import { BOARD_OPEN_COMMAND_ID, BOARD_TESTIDS as T } from '../../contract'
import { boardCtx } from '../lib/runtime'
import { useTrackViews } from '../lib/use-leave-board'
import { useBoardStore } from '../store'
import { PlainButton } from './PlainButton'

/** "Task Board" in the sidebar footer with the number of open tasks. */
export function SidebarBoardEntry() {
  const t = useT()
  const count = useBoardStore((s) => s.openCount)
  // Mounted from startup, so the view the board is first opened from is known.
  useTrackViews()
  return (
    <PlainButton
      data-testid={T.sidebarEntry}
      onClick={() => void boardCtx().commands.execute(BOARD_OPEN_COMMAND_ID)}
      className="flex h-[var(--row-h)] items-center gap-2 rounded-[var(--radius-button)] px-2 text-left text-[var(--mu)] hover:bg-[var(--hv)] hover:text-[var(--tx)]"
    >
      <Icon name={VIEW_ICON} size={ICON_PX.row} />
      <span className="flex-1">{t('board:sidebar.entry')}</span>
      {count > 0 && (
        <span
          data-testid={T.sidebarCount}
          title={t('board:sidebar.count', { count })}
          className="rounded-full bg-[var(--acs)] px-1.5 text-[11px] text-[var(--act)] leading-4"
        >
          {count}
        </span>
      )}
    </PlainButton>
  )
}
