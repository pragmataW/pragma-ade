import { useT } from '@pragma/sdk/renderer'
import { ToggleGroup, ToggleGroupItem } from '@pragma/ui/components/toggle-group'
import { VIEW_MODES } from '../../constants'
import { BOARD_TESTIDS as T } from '../../contract'
import { setMode, useBoardStore, type ViewMode } from '../store'

/** Board | List segmented control. */
export function ModeToggle() {
  const t = useT()
  const mode = useBoardStore((s) => s.mode)
  return (
    <ToggleGroup
      type="single"
      data-testid={T.modeToggle}
      aria-label={t('board:mode.label')}
      value={mode}
      onValueChange={(v) => v && setMode(v as ViewMode)}
      variant="outline"
    >
      {VIEW_MODES.map((m) => (
        <ToggleGroupItem key={m} value={m} className="px-2 text-[12px]">
          {t(`board:mode.${m}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
