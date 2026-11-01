import type { PtyService } from '@pragma/module-terminal/contract'
import type { SessionTracker } from './tracker'

/** Terminal output drives the tracker (used only while its source is `activity`). Returns the disposer. */
export function attachActivity(o: {
  pty: Pick<PtyService, 'onData'>
  ptyId: string
  tracker: SessionTracker
}): () => void {
  return o.pty.onData(o.ptyId, () => o.tracker.noteOutput())
}
