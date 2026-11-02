import type { PtyService } from '@pragma/module-terminal/contract'
import { INTERRUPT_KEYS } from '../constants'
import type { SessionTracker } from './tracker'

/**
 * Terminal output drives the tracker (activity status only while its source is `activity`; the provider monitor
 * always); interrupt keys typed into the terminal are passed to the monitor. Returns the disposer.
 */
export function attachActivity(o: {
  pty: Pick<PtyService, 'onData' | 'onInput'>
  ptyId: string
  tracker: SessionTracker
}): () => void {
  const offData = o.pty.onData(o.ptyId, () => o.tracker.noteOutput())
  const offInput = o.pty.onInput(o.ptyId, (data) => {
    if (INTERRUPT_KEYS.has(data)) o.tracker.noteInterruptKey()
  })
  return () => {
    offData()
    offInput()
  }
}
