import { BRACKETED_POLL_MS, BRACKETED_WAIT_MS, ENTER, NEWLINE, SUBMIT_DELAY_MS } from '../constants'
import { CommentsError, type DeliverFn, SEND_ERROR } from '../contract'
import { pollUntil, sleep } from './lib/wait'
import type { CommentsUpstream } from './upstream'

export interface TerminalDeliveryOptions {
  submitDelayMs?: number
  bracketedWaitMs?: number
  bracketedPollMs?: number
}

/**
 * Pastes into the session's pty. Multi-line text is only pasted once the program enabled bracketed paste (mode
 * 2004); otherwise every line would arrive as its own Enter. Optional Enter after `submitDelayMs`.
 */
export function createTerminalDelivery(up: CommentsUpstream, opts: TerminalDeliveryOptions = {}): DeliverFn {
  const submitDelayMs = opts.submitDelayMs ?? SUBMIT_DELAY_MS
  const waitMs = opts.bracketedWaitMs ?? BRACKETED_WAIT_MS
  const pollMs = opts.bracketedPollMs ?? BRACKETED_POLL_MS
  return async ({ ptyId, text, submit }) => {
    if (!ptyId) throw new CommentsError(SEND_ERROR.sessionNotRunning)
    if (text.includes(NEWLINE)) {
      const ready = await pollUntil(() => up.isBracketedPasteEnabled(ptyId), waitMs, pollMs)
      if (!ready) throw new CommentsError(SEND_ERROR.agentNotReady)
    }
    up.paste(ptyId, text)
    if (!submit) return
    await sleep(submitDelayMs)
    up.write(ptyId, ENTER)
  }
}
