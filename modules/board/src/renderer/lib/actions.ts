import { refresh, setError } from '../store'
import { errorNotice } from './errors'

const warnFailed = (what: string, e: unknown) => console.warn(`board: ${what} failed`, e)

/** Runs a UI action; a failure goes to the board's error banner (as a translated message) instead of a rejection. */
export function runAction(p: Promise<unknown>): void {
  p.catch((e: unknown) => {
    warnFailed('action', e)
    setError(errorNotice(e))
  })
}

/**
 * Runs a jump to a session or worktree that can race it ending or being removed: a failure shows `messageKey` in the
 * banner and refetches the board, so the control turns off.
 */
export function runNavigation(p: Promise<unknown>, messageKey: string): void {
  p.catch((e: unknown) => {
    warnFailed('navigation', e)
    setError({ messageKey })
    refresh().catch((r: unknown) => warnFailed('refresh', r))
  })
}
