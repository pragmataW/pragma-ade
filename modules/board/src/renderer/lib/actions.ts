import { errorMessage } from '../../contract'
import { setError } from '../store'

/** Runs a UI action; a failure goes to the board's error banner instead of an unhandled rejection. */
export function runAction(p: Promise<unknown>): void {
  p.catch((e: unknown) => setError(errorMessage(e)))
}
