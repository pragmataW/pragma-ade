import type { RendererContext } from '@pragma/sdk/renderer'
import { useStore } from 'zustand'
import type { BrowserSettings } from '../contract'
import type { BrowserState, BrowserStore } from './store'

/** The renderer pieces components use (set by `activate`, by tests through `setRuntime`). */
export interface BrowserRuntime {
  ctx: Pick<RendererContext<BrowserSettings>, 'ipc' | 'services' | 'settings' | 'panels'>
  store: BrowserStore
}

let current: BrowserRuntime | undefined

export const setRuntime = (rt: BrowserRuntime | undefined): void => {
  current = rt
}

export function runtime(): BrowserRuntime {
  if (!current) throw new Error('browser: renderer module is not active')
  return current
}

export const useBrowser = <T>(select: (s: BrowserState) => T): T => useStore(runtime().store, select)
