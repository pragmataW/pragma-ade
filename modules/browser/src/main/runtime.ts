import type { BrowserHost } from './guest'
import type { PickerService } from './picker/picker-service'
import type { BrowserTabManager } from './tab-manager'

/** The active module's main-side objects (test hooks and `deactivate` read them). */
export interface BrowserMainRuntime {
  manager: BrowserTabManager
  picker: PickerService
  host: BrowserHost
}

let current: BrowserMainRuntime | null = null

export class BrowserNotActiveError extends Error {}

export const setMainRuntime = (rt: BrowserMainRuntime | null): void => {
  current = rt
}

export function getMainRuntime(): BrowserMainRuntime {
  if (!current) throw new BrowserNotActiveError('browser module is not active')
  return current
}
