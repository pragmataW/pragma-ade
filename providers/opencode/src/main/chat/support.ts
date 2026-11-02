import { execFile } from 'node:child_process'
import type { AgentProfile } from '@pragma/module-agents/contract'
import type { ChatSupport } from '@pragma/module-chat/contract'
import type { CapabilityContext } from '@pragma/sdk'
import { MIN_MAJOR, REASON, VERSION_FLAG, VERSION_PROBE_TIMEOUT_MS } from './constants'
import { parseVersion } from './server/ready'

/** `<resolved> [profile args] --version` output (stdout + stderr), or '' on any failure or timeout. */
function probeVersion(command: string, args: string[], env: Record<string, string>): Promise<string> {
  return new Promise((resolve) => {
    execFile(command, [...args, VERSION_FLAG], { env, timeout: VERSION_PROBE_TIMEOUT_MS }, (error, stdout, stderr) =>
      resolve(error && !stdout ? '' : `${stdout}\n${stderr}`),
    )
  })
}

/**
 * Chat needs a resolvable command (SDK `resolveCommand`, §10.2) and OpenCode ≥ 2. An unparsable or slow `--version`
 * (e.g. a wrapper) is accepted here and checked again at start (`/api/info`). Not cached (11a caches failures).
 */
export async function checkOpencodeSupport(
  profile: Pick<AgentProfile, 'command' | 'args' | 'env'>,
  capCtx: Pick<CapabilityContext, 'getShellEnv' | 'resolveCommand'>,
): Promise<ChatSupport> {
  const command = profile.command.trim()
  if (!command) return { ok: false, reasonKey: REASON.emptyCommand }
  const resolved = await capCtx.resolveCommand(command)
  if (!resolved) return { ok: false, reasonKey: REASON.commandNotFound, detail: command }
  const env = { ...(await capCtx.getShellEnv()), ...profile.env }
  const version = parseVersion(await probeVersion(resolved, profile.args, env))
  if (version && version.major < MIN_MAJOR)
    return {
      ok: false,
      reasonKey: REASON.upgradeRequired,
      detail: `${version.major}.${version.minor}.${version.patch}`,
    }
  return { ok: true }
}
