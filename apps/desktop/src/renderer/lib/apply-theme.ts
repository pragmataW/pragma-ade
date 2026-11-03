import type { ThemeState } from '@pragma/sdk'
import { isTranslucentPalette } from '@pragma/ui/tokens'
import { backdropFor } from '../../backdrop'

/**
 * The shell owns theme application: data attributes drive tokens.css, glass.css and density.css. A translucent
 * palette also gets `data-backdrop` (what shows behind the glass on this OS); other palettes never carry it.
 */
export function applyTheme(root: HTMLElement, s: ThemeState, platform = ''): void {
  root.dataset.theme = s.resolved
  root.dataset.palette = s.palette
  root.dataset.density = s.density
  root.style.colorScheme = s.resolved
  if (isTranslucentPalette(s.palette)) root.dataset.backdrop = backdropFor(platform)
  else delete root.dataset.backdrop
}
