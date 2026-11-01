import type { ThemeMode } from '@pragma/sdk'
import { type RendererContext, useTheme } from '@pragma/sdk/renderer'
import type { GitChangesSettings } from '../../contract'

export type GitChangesRendererContext = RendererContext<GitChangesSettings>

export class RendererNotActivatedError extends Error {}

let current: GitChangesRendererContext | undefined

/** Holds the module's renderer context (set in `activate`, cleared by tests). */
export function setRendererCtx(ctx: GitChangesRendererContext | undefined): void {
  current = ctx
}

export function getRendererCtx(): GitChangesRendererContext {
  if (!current) throw new RendererNotActivatedError('git-changes renderer is not activated')
  return current
}

/** The resolved theme (`dark` | `light`), never `system` (§10.4). */
export const useThemeMode = (): ThemeMode => useTheme().resolved
