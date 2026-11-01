import type { StatusCapability } from '@pragma/module-agent-status/contract'
import { defineCapability } from '@pragma/sdk'
import { PROVIDER_ID } from '../constants'
import { mergeOpencodeConfigContent } from './status/config-content'
import { OPENCODE_CONFIG_ENV, OPENCODE_PLUGIN_RESOURCE } from './status/constants'
import { parseOpencodeEvent } from './status/parse-event'
import { withStandalone } from './status/standalone'

/**
 * Injects the status plugin through `OPENCODE_CONFIG_CONTENT.plugins` (+ `--standalone`) for one session; the user's
 * `~/.config/opencode` is never read or written, and no files are created.
 */
export function createOpencodeStatusCapability(deps: { pluginDir: string }): StatusCapability {
  return {
    async decorateLaunch(spec, ctx) {
      const { args, injectable } = withStandalone(spec.args)
      if (!injectable) return spec
      const existing =
        spec.env[OPENCODE_CONFIG_ENV] ?? ctx.env[OPENCODE_CONFIG_ENV] ?? ctx.shellEnv[OPENCODE_CONFIG_ENV]
      const merged = mergeOpencodeConfigContent(existing, deps.pluginDir)
      return { ...spec, args, env: { ...spec.env, [OPENCODE_CONFIG_ENV]: merged } }
    },
    parseEvent: parseOpencodeEvent,
  }
}

export default defineCapability(PROVIDER_ID, 'status', (capCtx) =>
  createOpencodeStatusCapability({ pluginDir: capCtx.paths.resource(OPENCODE_PLUGIN_RESOURCE) }),
)
