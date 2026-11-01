import { baseLaunchSpec, initialPromptOf, type LaunchCapability } from '@pragma/module-agents/contract'
import { type CapabilityContext, defineCapability } from '@pragma/sdk'
import { PROVIDER_ID } from '../constants'

/** Custom profiles: the prompt is the final positional, raw (no temp file, no padding, §5.2). No built-in profile. */
export function createLaunchCapability(_capCtx: CapabilityContext): LaunchCapability {
  return {
    async buildLaunch(ctx) {
      const spec = baseLaunchSpec(ctx)
      const prompt = initialPromptOf(ctx)
      return prompt === undefined ? spec : { ...spec, args: [...spec.args, prompt] }
    },
  }
}

export default defineCapability(PROVIDER_ID, 'launch', createLaunchCapability)
