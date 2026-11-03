import { useState } from 'react'

export const SEND = 'send'
export const CLEAR = 'clear resolved'

/** A busy flag around an async UI action; failures are logged (the store shows send errors itself). */
export function useBusy(what: string): [boolean, (action: () => Promise<unknown>) => Promise<void>] {
  const [busy, setBusy] = useState(false)
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await action()
    } catch (e) {
      console.warn(`comments: ${what} failed`, e)
    } finally {
      setBusy(false)
    }
  }
  return [busy, run]
}
