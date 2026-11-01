import { useSyncExternalStore } from 'react'
import type { ChatSettings } from '../../contract'
import { useChatHost } from '../host-adapter'

/** The chat settings section, re-rendering on change. */
export function useChatSettings(): ChatSettings {
  const { settings } = useChatHost()
  return useSyncExternalStore(
    (cb) => {
      const sub = settings.subscribe(cb)
      return () => sub.dispose()
    },
    () => settings.get(),
  )
}
