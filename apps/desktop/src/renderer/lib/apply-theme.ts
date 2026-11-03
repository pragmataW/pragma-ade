import type { ThemeState } from '@pragma/sdk'

/** The shell owns theme application: data attributes drive tokens.css and density.css. */
export function applyTheme(root: HTMLElement, s: ThemeState): void {
  root.dataset.theme = s.resolved
  root.dataset.palette = s.palette
  root.dataset.density = s.density
  root.style.colorScheme = s.resolved
}
