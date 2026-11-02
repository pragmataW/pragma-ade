import {
  type AgentProfile,
  type AgentSession,
  type AgentSessionsService,
  SESSION_STATUS,
} from '@pragma/module-agents/contract'
import { type BoardService, IN_PROGRESS_COLUMN_NAME, type TaskDto } from '@pragma/module-board/contract'
import type { ProjectsService, Worktree } from '@pragma/module-projects/contract'
import { type Logger, slugify } from '@pragma/sdk'
import { BOARD_MODULE_ID, HANDOFF_BRANCH_PREFIX, HANDOFF_SLUG_FALLBACK, HANDOFF_SLUG_MAX } from '../constants'
import { CLI_ERROR, type CliRequest, type CliResult, type CliTranscript } from '../contract'
import { CliError } from './cli-error'
import { findTasksForSession, resolveTask } from './handlers/task'
import { requireService } from './lib/require-service'
import { toCliError, toCliSession, toCliWorktree } from './mappers'
import type { Notifier } from './notifier'
import { resolveWorktree } from './resolve-context'
import { type ProfileNamer, resolveProfile } from './resolve-profile'
import { type TranscriptLocator, transcriptsOfPragmaSession } from './session-transcripts'

export interface HandoffDeps {
  projects: ProjectsService
  agents: AgentSessionsService
  board?: BoardService
  notifier: Notifier
  now: () => Date
  log: Logger
  nameOf: ProfileNamer
  transcripts: TranscriptLocator
}

const HEADING_RE = /^#{1,6}\s+(.+)$/m
const PAD = 2
const pad = (n: number): string => String(n).padStart(PAD, '0')
/** `YYYYMMDD-HHmm` in UTC (same clock as the card notes). */
const stamp = (d: Date): string =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`

/** `handoff/<slug of the first heading or line>-<YYYYMMDD-HHmm>`. */
export function deriveHandoffBranch(document: string, now: Date): string {
  const title = HEADING_RE.exec(document)?.[1] ?? document.split('\n').find((l) => l.trim()) ?? ''
  const slug = slugify(title, { maxLength: HANDOFF_SLUG_MAX }) || HANDOFF_SLUG_FALLBACK
  return `${HANDOFF_BRANCH_PREFIX}${slug}-${stamp(now)}`
}

const transcriptLines = (t: CliTranscript): string[] => [
  `- ${t.path} (${t.format}; ${t.providerId} session ${t.providerSessionId})`,
  ...(t.readCommand ? [`  Read it with: ${t.readCommand}`] : []),
  ...t.extraPaths.map((p) => `  Related: ${p}`),
]

/** Where the previous agent's full session lives; empty when no provider located it. */
export function buildTranscriptSection(transcripts: readonly CliTranscript[]): string[] {
  if (transcripts.length === 0) return []
  return [
    '',
    "The previous agent's full session transcript is stored locally. Read it only if the handoff document is not enough:",
    ...transcripts.flatMap(transcriptLines),
  ]
}

/** The target agent's first prompt (fixed English, §6). */
export function buildHandoffPrompt(
  document: string,
  from: { profileName: string; branch: string | null } | null,
  transcripts: readonly CliTranscript[] = [],
): string {
  const onBranch = from?.branch ? ` on branch ${from.branch}` : ''
  const source = from ? ` (${from.profileName}${onBranch})` : ''
  return [
    `You are taking over work handed off from another agent${source}.`,
    'Read the handoff document below, check the current state of the code, then continue the work.',
    'The previous agent has stopped; do not wait for it.',
    ...buildTranscriptSection(transcripts),
    '',
    '<handoff-document>',
    document,
    '</handoff-document>',
  ].join('\n')
}

const sourceTranscripts = (deps: HandoffDeps, sessionId: string | undefined): Promise<CliTranscript[]> =>
  sessionId
    ? transcriptsOfPragmaSession({ agents: deps.agents, projects: deps.projects, locator: deps.transcripts }, sessionId)
    : Promise.resolve([])

/** Appended to the description of the source session's cards. */
export function buildSourceNote(target: { profileName: string; sessionId: string; branch: string }, now: Date): string {
  const who = `${target.profileName} (session ${target.sessionId})`
  return `\n\n---\nHanded off to ${who} on branch \`${target.branch}\` at ${now.toISOString()}.\n`
}

async function sourceInfo(deps: HandoffDeps, sessionId: string | undefined, source: Worktree) {
  const session = sessionId ? await deps.agents.getSession(sessionId) : null
  const profile = session?.profileId ? await deps.agents.getProfile(session.profileId) : null
  return profile ? { profileName: deps.nameOf(profile), branch: source.branch } : null
}

async function createTarget(deps: HandoffDeps, req: CliRequest<'handoff'>, source: Worktree): Promise<Worktree> {
  const branch = req.branch ?? deriveHandoffBranch(req.document, deps.now())
  const baseBranch = req.baseBranch ?? source.branch ?? source.baseBranch
  try {
    return await deps.projects.createWorktree({ projectId: source.projectId, branch, baseBranch })
  } catch (e) {
    const err = toCliError(e)
    const code = err.code === CLI_ERROR.internal ? CLI_ERROR.conflict : err.code
    throw new CliError(
      code,
      `Could not create worktree '${branch}': ${err.message}. Pass --branch <name> to use another branch.`,
    )
  }
}

async function startTarget(
  deps: HandoffDeps,
  target: Worktree,
  profile: AgentProfile,
  initialPrompt: string,
  created: boolean,
): Promise<AgentSession> {
  let failure: string
  try {
    const session = await deps.agents.startSession({ worktreeId: target.id, profileId: profile.id, initialPrompt })
    if (session.status !== SESSION_STATUS.error) return session
    failure = session.error?.message ?? session.status
  } catch (e) {
    if (!created) throw e
    failure = e instanceof Error ? e.message : String(e)
  }
  if (!created) throw new CliError(CLI_ERROR.internal, `Could not start ${deps.nameOf(profile)}: ${failure}`)
  const where = `'${target.branch ?? target.path}' (${target.id})`
  throw new CliError(
    CLI_ERROR.internal,
    `Created worktree ${where} but could not start ${deps.nameOf(profile)}: ${failure}`,
    {
      worktreeId: target.id,
    },
  )
}

/** Steps 6–7: link + move the given card, note the source session's cards. Failures are logged, never fatal. */
async function updateCards(
  deps: HandoffDeps,
  req: CliRequest<'handoff'>,
  task: TaskDto | null,
  note: string,
  newSessionId: string,
): Promise<number[]> {
  const board = deps.board
  if (!board) return []
  if (task) {
    try {
      await board.linkSession(task.id, newSessionId)
      await board.moveTask(task.id, IN_PROGRESS_COLUMN_NAME)
    } catch (e) {
      deps.log.warn('handoff: could not update the task card', e)
    }
  }
  const sourceSessionId = req.context.sessionId
  if (!sourceSessionId) return []
  const noted: number[] = []
  const cards = await findTasksForSession(board, sourceSessionId).catch(() => [])
  for (const card of cards) {
    try {
      await board.updateTask(card.id, { descriptionMd: card.descriptionMd + note })
      noted.push(card.id)
    } catch (e) {
      deps.log.warn(`handoff: could not note card ${card.id}`, e)
    }
  }
  return noted
}

/** Validate everything first, then create the worktree, start the agent, update cards, notify. */
export async function runHandoff(req: CliRequest<'handoff'>, deps: HandoffDeps): Promise<CliResult<'handoff'>> {
  const profile = await resolveProfile(deps.agents, req.to, deps.nameOf)
  const source = await resolveWorktree(deps.projects, undefined, req.context)
  const task = req.taskId ? await resolveTask(requireService(deps.board, BOARD_MODULE_ID), req.taskId) : null
  const target = req.sameWorktree ? source : await createTarget(deps, req, source)
  const created = !req.sameWorktree
  const [from, transcripts] = await Promise.all([
    sourceInfo(deps, req.context.sessionId, source),
    sourceTranscripts(deps, req.context.sessionId),
  ])
  const prompt = buildHandoffPrompt(req.document, from, transcripts)
  const session = await startTarget(deps, target, profile, prompt, created)
  const profileName = deps.nameOf(profile)
  const note = buildSourceNote({ profileName, sessionId: session.id, branch: target.branch ?? target.path }, deps.now())
  const sourceTaskIds = await updateCards(deps, req, task, note, session.id)
  const result = {
    worktree: toCliWorktree(target),
    createdWorktree: created,
    session: toCliSession(session, profileName),
    taskId: task?.id ?? null,
    sourceTaskIds,
  }
  deps.notifier.notifyHandoff(result)
  return result
}
