/** Fake agent helpers without a test-runner dependency (vitest and Playwright specs both import them). */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from '@pragma/sdk'
import {
  type AgentProfile,
  BUILTIN_PROFILE_PREFIX,
  type CreateProfileInput,
  formatArgs,
  type UpdateProfilePatch,
} from '../src/contract'

const FAKE_AGENT_DIR = join(import.meta.dirname, 'fake-agent')
const WIN32 = 'win32'
export const FAKE_AGENT_WAIT_MS = 10_000
const POLL_MS = 50
const CUSTOM_PROVIDER_ID = 'custom'
const DEFAULT_FAKE_NAME = 'Fake'

/** Env vars the fake agent reads. */
export const FAKE_AGENT_ENV = {
  log: 'FAKE_AGENT_LOG',
  envKeys: 'FAKE_AGENT_ENV_KEYS',
  version: 'FAKE_AGENT_VERSION',
  exitAfterMs: 'FAKE_AGENT_EXIT_AFTER_MS',
  plugins: 'FAKE_AGENT_PLUGINS',
} as const

/** Absolute path of the fake agent (`.cmd` shim on win32). */
export const fakeAgentCommand = (): string =>
  join(FAKE_AGENT_DIR, process.platform === WIN32 ? 'fake-agent.cmd' : 'fake-agent.mjs')
export const fakeAgentScript = (): string => join(FAKE_AGENT_DIR, 'fake-agent.mjs')

const ts = z.number()
export const fakeAgentStartSchema = z.object({
  type: z.literal('start'),
  pid: z.number(),
  argv: z.array(z.string()),
  cwd: z.string(),
  env: z.record(z.string(), z.string()),
  ts,
})
export type FakeAgentStart = z.infer<typeof fakeAgentStartSchema>
export const fakeAgentLogEntrySchema = z.union([
  fakeAgentStartSchema,
  z.object({ type: z.literal('data'), text: z.string(), ts }),
  z.object({ type: z.literal('line'), line: z.string(), ts }),
  z.object({ type: z.literal('exit'), code: z.number(), signal: z.string().nullable(), ts }),
  /** Entries written by plugins. */
  z.looseObject({ type: z.string(), ts }),
])
export type FakeAgentLogEntry = z.infer<typeof fakeAgentLogEntrySchema>

/** Parsed JSONL log; a missing file is an empty log. */
export function readFakeAgentLog(path: string): FakeAgentLogEntry[] {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => fakeAgentLogEntrySchema.parse(JSON.parse(l)))
}

/** The `start` entries of a log (one per launch). */
export const fakeAgentStarts = (path: string): FakeAgentStart[] =>
  readFakeAgentLog(path).flatMap((e) => {
    const parsed = fakeAgentStartSchema.safeParse(e)
    return parsed.success ? [parsed.data] : []
  })

/** Polls the log until an entry matches. */
export async function waitForFakeAgentLog(
  path: string,
  predicate: (e: FakeAgentLogEntry) => boolean,
  timeoutMs = FAKE_AGENT_WAIT_MS,
): Promise<FakeAgentLogEntry> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = readFakeAgentLog(path).find(predicate)
    if (hit) return hit
    if (Date.now() > deadline) throw new Error(`fake agent log ${path}: no matching entry in ${timeoutMs}ms`)
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
}

/** The profile hooks `createFakeAgentProfile` needs (the agents test hooks satisfy it). */
export interface FakeAgentProfileHooks {
  createProfile(input: CreateProfileInput): Promise<AgentProfile>
  updateProfile(id: string, patch: UpdateProfilePatch): Promise<AgentProfile>
}

/**
 * A profile running the fake agent: a new custom profile, or (with a seeded `providerId`) a command override on that
 * provider's built-in profile.
 */
export function createFakeAgentProfile(
  hooks: FakeAgentProfileHooks,
  opts: { providerId?: string; name?: string; args?: string[]; env?: Record<string, string> } = {},
): Promise<AgentProfile> {
  const args = formatArgs(opts.args ?? [])
  const env = opts.env ?? {}
  if (!opts.providerId)
    return hooks.createProfile({
      providerId: CUSTOM_PROVIDER_ID,
      name: opts.name ?? DEFAULT_FAKE_NAME,
      command: fakeAgentCommand(),
      args,
      env,
    })
  return hooks.updateProfile(`${BUILTIN_PROFILE_PREFIX}${opts.providerId}`, { command: fakeAgentCommand(), args, env })
}
