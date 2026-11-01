import { useSyncExternalStore } from 'react'
import type { BrowserSettings } from '../../contract'
import { runtime } from '../runtime'

/** The browser settings section, re-rendering on change. */
export function useBrowserSettings(): BrowserSettings {
  const { settings } = runtime().ctx
  return useSyncExternalStore(
    (cb) => {
      const sub = settings.subscribe(cb)
      return () => sub.dispose()
    },
    () => settings.get(),
  )
}
