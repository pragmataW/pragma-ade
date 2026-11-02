import { CHAT_TESTIDS } from '../../contract'
import { ContextMeterView } from '../kit/controls/ContextMeter'
import { useChatStore } from '../session/store'

/** Status bar (ui-notes "context %"): the active chat session's context use; nothing otherwise. */
export function StatusbarContext() {
  const usage = useChatStore((s) => (s.activeSessionId ? s.sessions[s.activeSessionId]?.transcript.usage : null))
  return <ContextMeterView usage={usage} variant="text" testId={CHAT_TESTIDS.statusbarContext} />
}
