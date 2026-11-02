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
  /** An info key shown inline (e.g. nothing to resume, a fresh session started), cleared after `ALERT_MS`. */
  noticeKey: string | null
  switchTo(target: SwitchTarget): Promise<SwitchResult>
}

/** A key that clears itself `ALERT_MS` after it was set. */
function useTransientKey(): [string | null, (key: string | null) => void] {
  const [key, setKey] = useState<string | null>(null)
  useEffect(() => {
    if (!key) return
    const timer = setTimeout(() => setKey(null), ALERT_MS)
    return () => clearTimeout(timer)
  }, [key])
  return [key, setKey]
}

/** Eligibility (fetched on mount and on every `chat-switch.changed`), the session's phase and the inline alert. */
export function useSwitchState(sessionId: string, refreshKey: unknown): SwitchState {
  const client = useSwitchClient()
  const [eligibility, setEligibility] = useState<SwitchEligibility>()
  const [phase, setPhase] = useState<SwitchPhase>(SWITCH_PHASE.idle)
  const [alertKey, setAlertKey] = useTransientKey()
  const [noticeKey, setNoticeKey] = useTransientKey()
  const [version, setVersion] = useState(0)

  useEffect(() => {
    // any session's change can free (or take) this session's external id: refetch on every event
    const changed = client.onChanged((e) => {
      if (e.sessionId === sessionId) setPhase(e.phase)
      if (e.sessionId === sessionId && e.noticeKey) setNoticeKey(e.noticeKey)
      setVersion((v) => v + 1)
    })
    const conflict = client.onConflict((e) => {
      if (e.sessionId === sessionId) setAlertKey(CONFLICT_KEY)
    })
    return () => {
      changed.dispose()
      conflict.dispose()
    }
  }, [client, sessionId, setAlertKey, setNoticeKey])

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

  const switchTo = useCallback(
    async (target: SwitchTarget) => {
      setPhase(SWITCH_PHASE.switching)
      const r = await client.switchTo(sessionId, target)
      setPhase(r.ok ? SWITCH_PHASE.done : SWITCH_PHASE.failed)
      if (!r.ok) setAlertKey(r.errorKey)
      else if (r.noticeKey) setNoticeKey(r.noticeKey)
      setVersion((v) => v + 1)
      return r
    },
    [client, sessionId, setAlertKey, setNoticeKey],
  )
  return { eligibility, phase, alertKey, noticeKey, switchTo }
}
