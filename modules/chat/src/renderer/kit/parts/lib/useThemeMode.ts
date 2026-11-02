import type { ThemeMode } from '@pragma/sdk'
import { useSyncExternalStore } from 'react'
import { useChatHost } from '../../../host-adapter'

/** The resolved light/dark mode, re-rendering on change. */
export function useThemeMode(): ThemeMode {
  const { theme } = useChatHost()
  return useSyncExternalStore(
    (cb) => {
      const sub = theme.subscribe(cb)
      return () => sub.dispose()
    },
    () => theme.get(),
  )
}
