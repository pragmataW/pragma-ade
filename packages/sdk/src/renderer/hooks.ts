import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import type { ThemeState } from '../common/theme'
import { useRendererContext, useRendererHost } from './context'

/** `t` for a namespace; keys may also be fully qualified (`<ns>:<section>.<key>`). */
export function useT(namespace?: string) {
  return useTranslation(namespace).t
}

/** The current module's settings section, re-rendering on change. */
export function useModuleSettings<S>(): S {
  const ctx = useRendererContext<S>()
  return useSyncExternalStore(
    (cb) => {
      const sub = ctx.settings.subscribe(cb)
      return () => sub.dispose()
    },
    () => ctx.settings.get(),
  )
}

export function useTheme(): ThemeState {
  const { theme } = useRendererHost()
  return useSyncExternalStore(
    (cb) => {
      const sub = theme.onChange(cb)
      return () => sub.dispose()
    },
    () => theme.get(),
  )
}
