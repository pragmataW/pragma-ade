import type { ThemeApi } from '@pragma/sdk'
import type { ITheme } from '@xterm/xterm'
import { useMemo, useSyncExternalStore } from 'react'
import { buildXtermTheme } from './theme'

/** The xterm theme for the current app theme; re-computed on `theme.onChange`. */
export function useXtermTheme(theme: ThemeApi): ITheme {
  const state = useSyncExternalStore(
    (cb) => {
      const sub = theme.onChange(cb)
      return () => sub.dispose()
    },
    () => theme.get(),
  )
  return useMemo(() => buildXtermTheme(state.tokens, state.resolved), [state])
}
