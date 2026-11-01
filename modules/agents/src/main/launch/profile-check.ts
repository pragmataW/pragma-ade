import { execFile } from 'node:child_process'
import { stat } from 'node:fs/promises'
import type { Logger } from '@pragma/sdk'
import { CHECK_CACHE_TTL_MS, CHECK_TIMEOUT_MS, EXEC_OUTPUT_CAP_BYTES, LAUNCH_CAPABILITY } from '../../constants'
import {
  AGENTS_ERROR,
  type AgentProfile,
  AgentsError,
  type CompatibilityContext,
  type CompatibilityResult,
  compatibilityResultSchema,
  type ProfileCheck,
  RESOLUTION,
} from '../../contract'
import type { ProfilesStore, ProviderAccess } from '../profiles/profiles-store'
import { mergeEnv } from './env'
import type { ResolveFn } from './resolve'

type ExecResult = Awaited<ReturnType<CompatibilityContext['exec']>>
const UTF8 = 'utf8'

/** Runs a command without a shell; never rejects (a failure is a null exit code). */
export function execNoReject(command: string, args: string[], env: Record<string, string>): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      { env, timeout: CHECK_TIMEOUT_MS, maxBuffer: EXEC_OUTPUT_CAP_BYTES, encoding: UTF8 },
      (error, stdout, stderr) => {
        const code = error ? (error as { code?: unknown }).code : 0
        resolve({ exitCode: typeof code === 'number' ? code : null, stdout: stdout ?? '', stderr: stderr ?? '' })
      },
    )
  })
}

const mtimeOf = async (path: string): Promise<number> => (await stat(path).catch(() => null))?.mtimeMs ?? 0
const fingerprint = (p: AgentProfile, path: string, mtime: number) =>
  JSON.stringify([p.id, p.command, p.args, p.env, path, mtime])

export interface ProfileCheckerDeps {
  profiles: Pick<ProfilesStore, 'get'>
  providers: Pick<ProviderAccess, 'capability'>
  resolve: ResolveFn
  getShellEnv(): Promise<Record<string, string>>
  log: Logger
  now?: () => number
}

/** "Test launch": resolves the command, then runs the provider's advisory compatibility check (cached). */
export function createProfileChecker(deps: ProfileCheckerDeps) {
  const now = deps.now ?? Date.now
  const cache = new Map<string, { at: number; result: CompatibilityResult | null }>()

  async function compatibility(p: AgentProfile, path: string): Promise<CompatibilityResult | null> {
    const cap = deps.providers.capability(p.providerId, LAUNCH_CAPABILITY)
    if (!cap?.checkCompatibility) return null
    const key = fingerprint(p, path, await mtimeOf(path))
    const hit = cache.get(key)
    if (hit && now() - hit.at < CHECK_CACHE_TTL_MS) return hit.result
    const env = mergeEnv(await deps.getShellEnv(), p.env)
    let result: CompatibilityResult | null = null
    try {
      const exec = (args: string[]) => execNoReject(path, args, env)
      result = compatibilityResultSchema.parse(
        await cap.checkCompatibility({ profile: p, resolvedCommand: path, exec }),
      )
    } catch (error) {
      deps.log.warn(`compatibility check of ${p.id} failed`, error)
    }
    cache.set(key, { at: now(), result })
    return result
  }

  return {
    async check(id: string): Promise<ProfileCheck> {
      const p = deps.profiles.get(id)
      if (!p) throw new AgentsError(AGENTS_ERROR.profileNotFound, { id })
      const resolution = await deps.resolve(p.command)
      if (resolution.status !== RESOLUTION.found) return { resolution, compatibility: null }
      return { resolution, compatibility: await compatibility(p, resolution.path) }
    },
  }
}
export type ProfileChecker = ReturnType<typeof createProfileChecker>
