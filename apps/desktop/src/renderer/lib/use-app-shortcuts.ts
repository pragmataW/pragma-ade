import { toKeyInput } from '@pragma/sdk'
import type { RendererHost } from '@pragma/sdk/runtime/renderer'
import { useEffect } from 'react'

const KEYDOWN = 'keydown'
const APP_FOCUS = 'app'

/** One keydown handler for every app-scope (and global) shortcut while the shell has focus. */
export function useAppShortcuts(host: Pick<RendererHost, 'shortcuts' | 'commands' | 'log'>): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const spec = host.shortcuts.match(toKeyInput(e), APP_FOCUS)
      if (!spec) return
      e.preventDefault()
      const ref = typeof spec.command === 'string' ? { id: spec.command } : spec.command
      void host.commands.execute(ref.id, ref.args).catch((err) => host.log.error(`shortcut ${spec.id}`, err))
    }
    window.addEventListener(KEYDOWN, onKey, true)
    return () => window.removeEventListener(KEYDOWN, onKey, true)
  }, [host])
}
