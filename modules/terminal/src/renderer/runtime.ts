import type { RendererContext } from '@pragma/sdk/renderer'
import { type TerminalSettings, TerminalSettingsSchema } from '../contract'
import type { Workspace } from './panel/workspace-store'

/**
 * The terminal module's renderer context and workspace. `TerminalView` is also rendered by other modules (agents),
 * whose React tree carries their own module context, so the view reads the terminal's context from here.
 */
interface Runtime {
  ctx: RendererContext<TerminalSettings>
  workspace: Workspace
}

let current: Runtime | undefined

export const setRuntime = (r: Runtime | undefined): void => {
  current = r
}

function runtime(): Runtime {
  if (!current) throw new Error('terminal: renderer module is not active')
  return current
}

export const getRuntime = (): RendererContext<TerminalSettings> => runtime().ctx
export const getWorkspace = (): Workspace => runtime().workspace

/** The terminal settings with defaults filled in. */
export const readSettings = (): TerminalSettings => TerminalSettingsSchema.parse(getRuntime().settings.get() ?? {})
