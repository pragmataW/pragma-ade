import type { DaemonHost } from './daemon-host'
import type { TerminalLayoutStore } from './layout-store'
import type { PtyServiceImpl } from './pty-service'

/** The live main-side objects of the module; read by `test-hooks.ts` (test mode only). */
export interface TerminalMainRuntime {
  host: DaemonHost
  pty: PtyServiceImpl
  layouts: TerminalLayoutStore
  openExternal: (url: string) => Promise<void>
}

let current: TerminalMainRuntime | undefined

export const setMainRuntime = (r: TerminalMainRuntime | undefined): void => {
  current = r
}

export function getMainRuntime(): TerminalMainRuntime {
  if (!current) throw new Error('terminal: main module is not active')
  return current
}
