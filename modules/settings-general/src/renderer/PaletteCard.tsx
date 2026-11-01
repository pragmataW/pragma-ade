import type { PaletteId, ThemeMode } from '@pragma/sdk'
import { useT } from '@pragma/sdk/renderer'
import { Icon } from '@pragma/ui/components/icon'
import { cn } from '@pragma/ui/lib/utils'
import { palettes } from '@pragma/ui/tokens'
import type { CSSProperties } from 'react'
import { PREVIEW_SWATCHES } from '../constants'
import { TEST_IDS } from '../contract/testids'

const CHECK_PX = 14
const VAR_PREFIX = '--'

/** The palette's tokens as inline CSS variables (tokens.css scopes palettes to `:root` only). */
const paletteVars = (id: PaletteId, mode: ThemeMode): CSSProperties =>
  Object.fromEntries(Object.entries(palettes[id][mode]).map(([k, v]) => [`${VAR_PREFIX}${k}`, v])) as CSSProperties

/** Mini preview in its own `data-palette`/`data-theme` scope (with the palette's variables), in the current mode. */
export function PaletteCard({
  id,
  mode,
  selected,
  onSelect,
}: {
  id: PaletteId
  mode: ThemeMode
  selected: boolean
  onSelect(): void
}) {
  const t = useT()
  return (
    <button
      type="button"
      data-testid={TEST_IDS.paletteCard(id)}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex w-40 flex-col overflow-hidden rounded-[var(--radius-card)] border bg-[var(--el)] text-left',
        selected ? 'border-[var(--ac)]' : 'border-[var(--bd)] hover:border-[var(--bd2)]',
      )}
    >
      <div data-palette={id} data-theme={mode} style={paletteVars(id, mode)} className="flex h-16 bg-[var(--bg)]">
        <div className="w-6 bg-[var(--sb)]" />
        <div className="flex flex-1 flex-col gap-1.5 p-2">
          {PREVIEW_SWATCHES.map((token) => (
            <div key={token} className="h-1.5 rounded-full" style={{ background: `var(${VAR_PREFIX}${token})` }} />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between px-2 py-1.5 text-xs">
        <span>{t(`settings-general:appearance.palettes.${id}`)}</span>
        {selected && (
          <span className="text-[var(--act)]" title={t('settings-general:appearance.selected')}>
            <Icon name="check" size={CHECK_PX} />
          </span>
        )}
      </div>
    </button>
  )
}
