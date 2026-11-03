import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AgentProfile, AgentSessionsService } from '@pragma/module-agents/contract'
import type { ProjectsService } from '@pragma/module-projects/contract'
import type { Logger } from '@pragma/sdk'
import { ASK_MAX_STDOUT_BYTES, ASK_TEMP_PREFIX } from '../../constants'
import {
  type AskAnswer,
  type AskCapability,
  type AskSpec,
  CLI_ERROR,
  type CliCallerContext,
  MAX_DOCUMENT_BYTES,
  MS_PER_S,
} from '../../contract'
import { CliError } from '../cli-error'
import { resolveWorktree } from '../resolve-context'
import { type ProfileNamer, resolveProfile } from '../resolve-profile'
import { ASK_OUTCOME, type RunAskOutcome, runAskProcess } from './process'

/** A provider that implements `ask`. */
export interface AskProvider {
  id: string
  ask: AskCapability
}

export interface AskDeps {
  projects: ProjectsService
  agents: AgentSessionsService
  nameOf: ProfileNamer
  /** Read on every call (providers can be enabled or disabled while the app runs). */
  providers(): AskProvider[]
  /** Each question gets its own temp dir in here, removed afterwards. */
  tempRoot: string
  log: Logger
  now(): number
}

export interface AskInput {
  context: CliCallerContext
  /** Profile id or name. */
  to: string
  prompt: string
  timeoutSeconds: number
}

export interface AskOutcome {
  profile: { id: string; name: string; providerId: string }
  text: string
  truncated: boolean
  durationMs: number
}

const LIST_JOIN = ', '
const PRIVATE_FILE_MODE = 0o600
/** UTF-8 continuation bytes are `10xxxxxx`. */
const UTF8_CONTINUATION_MASK = 0xc0
const UTF8_CONTINUATION = 0x80

/** Fixed English sent to the consulted agent (not i18n, §6). */
const ASK_PREAMBLE = [
  'You are being consulted by another coding agent through Pragma ADE. It is waiting for your reply and will act on it.',
  'Do not modify, create or delete files, and do not run commands that change anything; you may read files to answer.',
  'Answer concisely: the answer first, then only the reasoning the other agent needs.',
].join('\n')

export function buildAskPrompt(question: string): string {
  return `${ASK_PREAMBLE}\n\n<question>\n${question.trim()}\n</question>\n`
}

/** At most `MAX_DOCUMENT_BYTES` UTF-8 bytes, never splitting a character. */
function capText(text: string): { text: string; truncated: boolean } {
  const bytes = Buffer.from(text)
  if (bytes.length <= MAX_DOCUMENT_BYTES) return { text, truncated: false }
  let end = MAX_DOCUMENT_BYTES
  while (end > 0 && ((bytes[end] ?? 0) & UTF8_CONTINUATION_MASK) === UTF8_CONTINUATION) end--
  return { text: bytes.subarray(0, end).toString(), truncated: true }
}

async function pickProvider(deps: AskDeps, profile: AgentProfile): Promise<AskCapability> {
  const providers = deps.providers()
  const found = providers.find((p) => p.id === profile.providerId)
  if (found) return found.ask
  const able = new Set(providers.map((p) => p.id))
  const names = (await deps.agents.listProfiles()).filter((p) => p.enabled && able.has(p.providerId)).map(deps.nameOf)
  const which = names.length > 0 ? `Profiles that can: ${names.join(LIST_JOIN)}.` : 'No enabled profile can.'
  throw new CliError(CLI_ERROR.invalid_argument, `Profile '${deps.nameOf(profile)}' cannot answer questions. ${which}`)
}

async function buildSpec(ask: AskCapability, profile: AgentProfile, cwd: string, prompt: string, dir: string) {
  const writeTempFile = async (name: string, contents: string) => {
    const path = join(dir, name)
    await writeFile(path, contents, { mode: PRIVATE_FILE_MODE })
    return path
  }
  try {
    return await ask.buildAsk({ profile, cwd, prompt, writeTempFile })
  } catch (e) {
    throw new CliError(CLI_ERROR.internal, e instanceof Error ? e.message : String(e))
  }
}

/** A finished process → the answer; everything else → a `CliError` (fixed English). */
function answerOf(outcome: RunAskOutcome, ask: AskCapability, name: string, timeoutSeconds: number): string {
  switch (outcome.kind) {
    case ASK_OUTCOME.timedOut:
      throw new CliError(CLI_ERROR.timeout, `${name} did not answer within ${timeoutSeconds} s.`)
    case ASK_OUTCOME.aborted:
      throw new CliError(CLI_ERROR.internal, 'The question was cancelled.')
    case ASK_OUTCOME.tooLarge:
      throw new CliError(CLI_ERROR.internal, `${name} produced more than ${ASK_MAX_STDOUT_BYTES} bytes of output.`)
    case ASK_OUTCOME.spawnFailed:
      throw new CliError(CLI_ERROR.internal, `Could not start ${name}: ${outcome.message}`)
    case ASK_OUTCOME.exited: {
      const answer: AskAnswer = ask.parseAnswer(outcome)
      if (!answer.ok) throw new CliError(CLI_ERROR.internal, `${name} could not answer: ${answer.message}`)
      return answer.text
    }
    default: {
      const never: never = outcome
      throw new Error(`unhandled outcome ${JSON.stringify(never)}`)
    }
  }
}

async function runInTempDir<T>(root: string, fn: (dir: string) => Promise<T>): Promise<T> {
  await mkdir(root, { recursive: true })
  const dir = await mkdtemp(join(root, ASK_TEMP_PREFIX))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** One headless question to `input.to`'s provider, run in the caller's worktree; the prompt is never logged. */
export async function runAsk(input: AskInput, deps: AskDeps, signal: AbortSignal): Promise<AskOutcome> {
  const started = deps.now()
  const profile = await resolveProfile(deps.agents, input.to, deps.nameOf)
  const ask = await pickProvider(deps, profile)
  const name = deps.nameOf(profile)
  const { path: cwd } = await resolveWorktree(deps.projects, undefined, input.context)
  const prompt = buildAskPrompt(input.prompt)
  const raw = await runInTempDir(deps.tempRoot, async (dir) => {
    const spec: AskSpec = await buildSpec(ask, profile, cwd, prompt, dir)
    const outcome = await runAskProcess(spec, { cwd, timeoutMs: input.timeoutSeconds * MS_PER_S, signal })
    return answerOf(outcome, ask, name, input.timeoutSeconds)
  })
  const durationMs = Math.max(0, deps.now() - started)
  deps.log.info(`cli-integration: ${profile.id} (${profile.providerId}) answered in ${durationMs} ms`)
  return { profile: { id: profile.id, name, providerId: profile.providerId }, ...capText(raw), durationMs }
}
