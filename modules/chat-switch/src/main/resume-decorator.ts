import type { LaunchDecorator } from '@pragma/module-agents/contract'
import type { MainContext } from '@pragma/sdk/main'
import {
  RESUME_CAPABILITY,
  RESUME_DECORATOR_ID,
  RESUME_DECORATOR_ORDER,
  SWITCH_ERROR,
  SWITCH_REASON,
  switchErrorKey,
  switchReasonKey,
} from '../constants'
import type { ExternalSessionGuard } from '../contract'

export interface ResumeDecoratorDeps {
  providers: Pick<MainContext['providers'], 'capability'>
  guard: ExternalSessionGuard
}

/**
 * Turns 03's `LaunchContext.resume` into the provider's resume args/env and claims the guard at the spawn point. It
 * runs before 04's status decorator, so OpenCode's `--server` is visible there (04 then adds no `--standalone`).
 */
export function createResumeDecorator(deps: ResumeDecoratorDeps): LaunchDecorator {
  return {
    id: RESUME_DECORATOR_ID,
    order: RESUME_DECORATOR_ORDER,
    async decorate(spec, ctx) {
      if (!ctx.resume) return spec
      const { externalSessionId, serverUrl } = ctx.resume
      const providerId = ctx.profile.providerId
      if (!deps.guard.claim({ providerId, externalSessionId }, ctx.sessionId).ok)
        throw new Error(switchErrorKey(SWITCH_ERROR.busy))
      const cap = deps.providers.capability(providerId, RESUME_CAPABILITY)
      if (!cap) throw new Error(switchReasonKey(SWITCH_REASON.noResume))
      const r = cap.terminalResumeArgs({ externalSessionId, ...(serverUrl ? { serverUrl } : {}) })
      return { ...spec, args: [...spec.args, ...r.args], env: { ...spec.env, ...r.env } }
    },
  }
}
