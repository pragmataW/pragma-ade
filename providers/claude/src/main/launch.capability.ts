import {
  baseLaunchSpec,
  initialPromptOf,
  type LaunchCapability,
  padFlagLike,
  resolvePromptText,
} from '@pragma/module-agents/contract'
import { type CapabilityContext, defineCapability } from '@pragma/sdk'
import { PROVIDER_ID } from '../constants'

/** Claude is the first built-in profile (the default on first run). */
const SEED_ORDER = 10

/**
 * Claude Code 2.x: `claude [options] [command] [prompt]`. The prompt is the final positional; a one-word prompt is
 * padded with a space so it is never dispatched as a subcommand (`update`, `mcp`, …), and a leading `-` likewise.
 */
export function createLaunchCapability(_capCtx: CapabilityContext): LaunchCapability {
  return {
    seed: { order: SEED_ORDER },
    async buildLaunch(ctx) {
      const spec = baseLaunchSpec(ctx)
      const prompt = initialPromptOf(ctx)
      if (prompt === undefined) return spec
      const { text, tempFiles } = await resolvePromptText(ctx, prompt)
      return { ...spec, args: [...spec.args, padFlagLike(text, { singleWord: true })], tempFiles }
    },
  }
}

export default defineCapability(PROVIDER_ID, 'launch', createLaunchCapability)
