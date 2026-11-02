import { useCallback, useEffect, useState } from 'react'
import { ALERT_MS, CONFLICT_KEY } from '../constants'
import {
  SWITCH_PHASE,
  type SwitchEligibility,
  type SwitchPhase,
  type SwitchResult,
  type SwitchTarget,
} from '../contract'
import { useSwitchClient } from './switch-client'

export interface SwitchState {
  eligibility?: SwitchEligibility
  phase: SwitchPhase
  /** A translated-later key shown inline (failure or conflict), cleared after `ALERT_MS`. */
  alertKey: string | null
  switchTo(target: SwitchTarget): Promise<SwitchResult>
}

/** Eligibility (fetched on mount and on every `chat-switch.changed` for the session), phase and the inline alert. */
export function useSwitchState(sessionId: string, refreshKey: unknown): SwitchState {
  const client = useSwitchClient()
  const [eligibility, setEligibility] = useState<SwitchEligibility>()
  const [phase, setPhase] = useState<SwitchPhase>(SWITCH_PHASE.idle)
  const [alertKey, setAlertKey] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const changed = client.onChanged((e) => {
      if (e.sessionId !== sessionId) return
      setPhase(e.phase)
      setVersion((v) => v + 1)
    })
    const conflict = client.onConflict((e) => {
      if (e.sessionId === sessionId) setAlertKey(CONFLICT_KEY)
    })
    return () => {
      changed.dispose()
      conflict.dispose()
    }
  }, [client, sessionId])

  useEffect(() => {
    let live = true
    void version
    void refreshKey
    client
      .eligibility(sessionId)
      .then((e) => {
        if (live) setEligibility(e)
      })
      .catch((e: unknown) => console.warn(`chat-switch: eligibility of ${sessionId} failed`, e))
    return () => {
      live = false
    }
  }, [client, sessionId, version, refreshKey])

  useEffect(() => {
    if (!alertKey) return
    const timer = setTimeout(() => setAlertKey(null), ALERT_MS)
    return () => clearTimeout(timer)
  }, [alertKey])

  const switchTo = useCallback(
    async (target: SwitchTarget) => {
      setPhase(SWITCH_PHASE.switching)
      const r = await client.switchTo(sessionId, target)
      setPhase(r.ok ? SWITCH_PHASE.done : SWITCH_PHASE.failed)
      if (!r.ok) setAlertKey(r.errorKey)
      setVersion((v) => v + 1)
      return r
    },
    [client, sessionId],
  )
  return { eligibility, phase, alertKey, switchTo }
}
