import { z } from '@pragma/sdk'
import { keyedEnum } from './constants'
import type { AgentProfile } from './profiles'
import type { PromptFileWriter } from './prompt'
import type { Resume } from './sessions'

declare module '@pragma/sdk' {
  interface CapabilityMap {
    launch: LaunchCapability
  }
}

export interface LaunchContext extends PromptFileWriter {
  profile: AgentProfile
  worktreePath: string
  sessionId: string
  initialPrompt?: string
  /** Additions so far: profile env + `AGENT_ENV` ids. */
  env: Record<string, string>
  worktreeId: string
  /** 11c: `{ externalSessionId, serverUrl? }`; its decorator turns it into args/env. */
  resume?: Resume
  /** Owner extension: the session mode, so decorators can adapt. */
  mode: string
  /** Owner extension: the read-only login-shell env (e.g. 10 prepends PATH). */
  shellEnv: Readonly<Record<string, string>>
  /** Owner extension: per-session dir (0700), deleted at session end; `writeTempFile` writes 0600 files into it. */
  tempDir: string
}

export const launchSpecSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()),
  /** ADDITIONS/OVERRIDES, merged over the shell env by 03 (§10.3). */
  env: z.record(z.string(), z.string()),
  cwd: z.string().min(1),
  tempFiles: z.array(z.string()).optional(),
})
export type LaunchSpec = z.infer<typeof launchSpecSchema>

export interface CompatibilityContext {
  profile: AgentProfile
  resolvedCommand: string
  /** Runs the resolved command without a shell; never rejects. */
  exec(args: string[]): Promise<{ exitCode: number | null; stdout: string; stderr: string }>
}

export const compatibilityResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), version: z.string().optional() }),
  z.object({ ok: z.literal(false), reasonKey: z.string(), params: z.record(z.string(), z.string()).optional() }),
])
export type CompatibilityResult = z.infer<typeof compatibilityResultSchema>

export interface LaunchCapability {
  buildLaunch(ctx: LaunchContext): Promise<LaunchSpec>
  /** Owner extension: create a built-in profile; the lowest order is the first default. */
  seed?: { order: number }
  /** Owner extension: advisory, never blocks a launch. */
  checkCompatibility?(ctx: CompatibilityContext): Promise<CompatibilityResult>
}

const COMMAND_RESOLUTION_LIST = ['found', 'notFound', 'notExecutable'] as const
export type CommandResolutionStatus = (typeof COMMAND_RESOLUTION_LIST)[number]
export const RESOLUTION = keyedEnum(COMMAND_RESOLUTION_LIST)

export const commandResolutionSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal(RESOLUTION.found), path: z.string() }),
  z.object({ status: z.literal(RESOLUTION.notFound) }),
  z.object({ status: z.literal(RESOLUTION.notExecutable), path: z.string() }),
])
export type CommandResolution = z.infer<typeof commandResolutionSchema>

export const profileCheckSchema = z.object({
  resolution: commandResolutionSchema,
  compatibility: compatibilityResultSchema.nullable(),
})
export type ProfileCheck = z.infer<typeof profileCheckSchema>

export interface LaunchDecorator {
  id: string
  order: number
  decorate(spec: LaunchSpec, ctx: LaunchContext): Promise<LaunchSpec>
}
