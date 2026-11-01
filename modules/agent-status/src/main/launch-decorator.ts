import { type LaunchDecorator, TERMINAL_MODE } from '@pragma/module-agents/contract'
import { BRIDGE_ENV, type BridgeServer } from '@pragma/module-bridge/contract'
import type { Logger } from '@pragma/sdk'
import { DECORATOR_ID, DECORATOR_ORDER } from '../constants'
import { STATUS_SOURCE, type StatusCapability } from '../contract'
import type { StatusStore } from './status-store'

export interface StatusDecoratorDeps {
  bridge(): BridgeServer | undefined
  statusCapability(providerId: string): StatusCapability | undefined
  store: StatusStore
  log: Pick<Logger, 'warn'>
}

/** Adds the bridge env to every launch and lets the provider's `status` capability inject its hooks. */
export function createStatusLaunchDecorator(deps: StatusDecoratorDeps): LaunchDecorator {
  return {
    id: DECORATOR_ID,
    order: DECORATOR_ORDER,
    async decorate(spec, ctx) {
      const track = (source: (typeof STATUS_SOURCE)[keyof typeof STATUS_SOURCE]) =>
        deps.store.track({ sessionId: ctx.sessionId, worktreeId: ctx.worktreeId, source })
      const bridge = deps.bridge()
      if (!bridge) {
        track(STATUS_SOURCE.activity)
        return spec
      }
      const withEnv = { ...spec, env: { ...spec.env, [BRIDGE_ENV.url]: bridge.url, [BRIDGE_ENV.token]: bridge.token } }
      if (ctx.mode !== TERMINAL_MODE) {
        track(STATUS_SOURCE.external)
        return withEnv
      }
      const cap = deps.statusCapability(ctx.profile.providerId)
      if (!cap) {
        track(STATUS_SOURCE.activity)
        return withEnv
      }
      try {
        const decorated = await cap.decorateLaunch(withEnv, {
          ...ctx,
          bridgeUrl: bridge.url,
          bridgeToken: bridge.token,
        })
        track(STATUS_SOURCE.pendingHooks)
        return decorated
      } catch (e) {
        deps.log.warn(`status hooks for ${ctx.profile.providerId} could not be injected; using terminal activity`, e)
        track(STATUS_SOURCE.activity)
        return withEnv
      }
    },
  }
}
