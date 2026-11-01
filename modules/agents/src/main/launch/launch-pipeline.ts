import type { Logger } from '@pragma/sdk'
import { LAUNCH_CAPABILITY } from '../../constants'
import {
  AGENTS_ERROR,
  AgentsError,
  baseLaunchSpec,
  type LaunchContext,
  type LaunchDecorator,
  type LaunchSpec,
  launchSpecSchema,
  RESOLUTION,
} from '../../contract'
import type { ProviderAccess } from '../profiles/profiles-store'
import { applyDecorators } from './decorators'
import { mergeEnv } from './env'
import type { ResolveFn } from './resolve'

export interface DecoratorSource {
  list(): LaunchDecorator[]
}

export interface LaunchPipelineDeps {
  providers: Pick<ProviderAccess, 'capability'>
  decorators: DecoratorSource
  resolve: ResolveFn
  log: Logger
}

export interface LaunchPlan {
  spec: LaunchSpec
  resolvedCommand: string
  /** The full process env (shell env ⊕ spec additions). */
  env: Record<string, string>
}

/** capability `buildLaunch` → decorators → env merge → command resolution. */
export async function runLaunchPipeline(deps: LaunchPipelineDeps, ctx: LaunchContext): Promise<LaunchPlan> {
  const providerId = ctx.profile.providerId
  const cap = deps.providers.capability(providerId, LAUNCH_CAPABILITY)
  if (!cap) throw new AgentsError(AGENTS_ERROR.providerUnavailable, { providerId })
  const built = launchSpecSchema.parse(await cap.buildLaunch(ctx))
  const spec = await applyDecorators(deps.decorators.list(), built, ctx, deps.log)
  const env = mergeEnv(ctx.shellEnv, spec.env)
  const resolution = await deps.resolve(spec.command)
  if (resolution.status !== RESOLUTION.found)
    throw new AgentsError(AGENTS_ERROR.commandNotFound, { command: spec.command })
  return { spec, resolvedCommand: resolution.path, env }
}

/** §10.3 env-only pipeline (11a chat): decorators run on a seed spec; only their env survives. */
export async function runEnvPipeline(
  deps: Pick<LaunchPipelineDeps, 'decorators' | 'log'>,
  ctx: LaunchContext,
): Promise<Record<string, string>> {
  const seed = baseLaunchSpec(ctx)
  const spec = await applyDecorators(deps.decorators.list(), { ...seed, command: seed.command || ' ' }, ctx, deps.log)
  return mergeEnv(ctx.shellEnv, spec.env)
}
