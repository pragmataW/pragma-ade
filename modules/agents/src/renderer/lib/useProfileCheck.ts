import { useEffect } from 'react'
import type { ProfileCheck } from '../../contract'
import { useAgents } from '../active-worktree'
import { getRuntime } from '../runtime'

/** `agents.checkProfile` for a profile, cached in the store and invalidated by `profilesChanged`. */
export function useProfileCheck(profileId: string | null | undefined): ProfileCheck | undefined {
  const check = useAgents((s) => (profileId ? s.checks[profileId] : undefined))
  useEffect(() => {
    if (!profileId || check) return
    getRuntime()
      .store.getState()
      .refreshCheck(profileId)
      .catch((e: unknown) => console.warn('agents: checkProfile failed', e))
  }, [profileId, check])
  return check
}
