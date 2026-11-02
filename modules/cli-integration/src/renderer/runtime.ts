import type { RendererContext } from '@pragma/sdk/renderer'

/** The renderer pieces the settings page uses (set by `activate`, by tests through `setCliRuntime`). */
export interface CliRuntime {
  ctx: Pick<RendererContext, 'ipc'>
}

let current: CliRuntime | undefined

export const setCliRuntime = (rt: CliRuntime | undefined): void => {
  current = rt
}

export function cliRuntime(): CliRuntime {
  if (!current) throw new Error('cli-integration: renderer module is not active')
  return current
}
