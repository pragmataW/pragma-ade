import { useEffect } from 'react'
import type { ProfileCheck } from '../../contract'
import { useAgents } from '../active-worktree'
import { getRuntime } from '../runtime'

/** Re-runs `agents.checkProfile` (advisory: failures only reach the console). */
export function refreshCheck(profileId: string): void {
  getRuntime()
    .store.getState()
    .refreshCheck(profileId)
    .catch((e: unknown) => console.warn('agents: checkProfile failed', e))
}

/** `agents.checkProfile` for a profile, cached in the store and invalidated by `profilesChanged`. */
export function useProfileCheck(profileId: string | null | undefined): ProfileCheck | undefined {
  const check = useAgents((s) => (profileId ? s.checks[profileId] : undefined))
  useEffect(() => {
    if (!profileId || check) return
    refreshCheck(profileId)
  }, [profileId, check])
  return check
}
