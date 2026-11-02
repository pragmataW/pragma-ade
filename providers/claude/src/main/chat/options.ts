import { randomUUID } from 'node:crypto'
import type { CanUseTool, ModelInfo, Options, SDKControlInitializeResponse } from '@anthropic-ai/claude-agent-sdk'
import {
  CHAT_OPTION_KEYS,
  type ChatOptionDescriptor,
  type ChatOptionValue,
  type ChatSessionContext,
  OPTION_TYPE,
} from '@pragma/module-chat/contract'
import {
  type ClaudePermissionMode,
  DEFAULT_MODEL_VALUE,
  DEFAULT_PERMISSION_MODE,
  EFFORT_LEVELS,
  FAST_MODE_OPTION,
  FLAG_VALUE_SEPARATOR,
  PERMISSION_FLAGS,
  PERMISSION_MODE,
  PERMISSION_MODE_STYLE,
  PERMISSION_MODES,
  PLAN_APPROVE_MODES,
  REPLAY_USER_MESSAGES_FLAG,
  SYSTEM_PRESET,
} from './constants'
import { buildClaudeChildEnv } from './env'
import type { ClaudeProcessSpawn } from './spawn'

const FLAGS = new Set<string>(PERMISSION_FLAGS)

/** The profile args already decide permissions (`--dangerously-skip-permissions`, `--permission-mode[=…]`, …). */
export const hasPermissionFlag = (args: readonly string[]): boolean =>
  args.some((a) => FLAGS.has(a.split(FLAG_VALUE_SEPARATOR)[0] ?? a))

export interface ClaudeOptionState {
  model: string | null
  effort: string | null
  permissionMode: string | null
  fastMode: boolean
}

const asString = (v: ChatOptionValue | undefined): string | null => (typeof v === 'string' ? v : null)

export function initialOptionState(ctx: Pick<ChatSessionContext, 'initialOptions' | 'profile'>): ClaudeOptionState {
  const o = ctx.initialOptions ?? {}
  const permission = hasPermissionFlag(ctx.profile.args)
    ? null
    : (asString(o.permissionMode) ?? DEFAULT_PERMISSION_MODE)
  return {
    model: asString(o.model),
    effort: asString(o.effort),
    permissionMode: permission,
    fastMode: o[FAST_MODE_OPTION] === true,
  }
}

/** `query()` options; `resume` xor a fresh `sessionId`. */
export function buildQueryOptions(
  ctx: ChatSessionContext,
  spawner: Pick<ClaudeProcessSpawn, 'spawn'>,
  canUseTool: CanUseTool,
  abort: AbortController,
  sessionId: string = ctx.resumeExternalSessionId ?? randomUUID(),
): Options {
  const state = initialOptionState(ctx)
  const options: Options = {
    pathToClaudeCodeExecutable: ctx.profile.command,
    cwd: ctx.worktreePath,
    env: buildClaudeChildEnv(ctx.env),
    spawnClaudeCodeProcess: spawner.spawn,
    includePartialMessages: true,
    // subagents: their full conversation (nested cards), live one-line summaries, and our per-task Stop control
    forwardSubagentText: true,
    agentProgressSummaries: true,
    perTaskStopAffordance: true,
    // lets the user switch to `bypassPermissions` mid-session (the kit confirms it first); the start mode is unchanged
    allowDangerouslySkipPermissions: true,
    // backups before each edit, so `rewind` can restore the files of an earlier user message
    enableFileCheckpointing: true,
    // mid-turn messages: the CLI echoes each user message once it takes it in (clears the "sent while working" mark)
    extraArgs: { [REPLAY_USER_MESSAGES_FLAG]: null },
    systemPrompt: { ...SYSTEM_PRESET },
    canUseTool,
    abortController: abort,
    model: state.model ?? undefined,
    effort: (state.effort ?? undefined) as Options['effort'],
    permissionMode: (state.permissionMode ?? undefined) as Options['permissionMode'],
  }
  return ctx.resumeExternalSessionId ? { ...options, resume: sessionId } : { ...options, sessionId }
}

const DEFAULT_LABEL_KEY = 'claude:chat.option.defaultModel'
const DEFAULT_CHOICE = { value: null, labelKey: DEFAULT_LABEL_KEY }
const isDefaultModel = (m: ModelInfo) => m.value === DEFAULT_MODEL_VALUE

function currentModel(models: ModelInfo[], model: string | null): ModelInfo | undefined {
  return models.find((m) => m.value === model) ?? models.find(isDefaultModel) ?? models[0]
}

const describedBy = (m: ModelInfo) => (m.description ? { description: m.description } : {})

/** Every `supportedModels()` entry; the CLI's own "default" row becomes the `null` (CLI default) choice. */
function modelDescriptor(models: ModelInfo[], state: ClaudeOptionState): ChatOptionDescriptor {
  const cliDefault = models.find(isDefaultModel)
  const first = cliDefault ? { value: null, label: cliDefault.displayName, ...describedBy(cliDefault) } : DEFAULT_CHOICE
  const rest = models
    .filter((m) => !isDefaultModel(m))
    .map((m) => ({ value: m.value, label: m.displayName, ...describedBy(m) }))
  return {
    key: CHAT_OPTION_KEYS.model,
    type: OPTION_TYPE.enum,
    labelKey: 'chat:option.model',
    values: [first, ...rest],
    default: null,
    current: state.model === DEFAULT_MODEL_VALUE ? null : state.model,
  }
}

function effortDescriptor(models: ModelInfo[], state: ClaudeOptionState): ChatOptionDescriptor | undefined {
  const model = currentModel(models, state.model)
  if (!model?.supportsEffort) return undefined
  const supported = new Set<string>(model.supportedEffortLevels ?? EFFORT_LEVELS)
  const levels = EFFORT_LEVELS.filter((l) => supported.has(l))
  const values = levels.map((value) => ({ value, labelKey: `claude:chat.effort.${value}` }))
  return {
    key: CHAT_OPTION_KEYS.effort,
    type: OPTION_TYPE.enum,
    labelKey: 'chat:option.effort',
    values: [DEFAULT_CHOICE, ...values],
    default: null,
    // a level the newly picked model lacks reads as the default (the CLI downgrades it too)
    current: state.effort && supported.has(state.effort) ? state.effort : null,
  }
}

/** Fast mode, only for models that support it. */
function fastModeDescriptor(models: ModelInfo[], state: ClaudeOptionState): ChatOptionDescriptor | undefined {
  if (!currentModel(models, state.model)?.supportsFastMode) return undefined
  return {
    key: FAST_MODE_OPTION,
    type: OPTION_TYPE.boolean,
    labelKey: 'claude:chat.option.fastMode',
    descriptionKey: 'claude:chat.option.fastModeHint',
    default: false,
    current: state.fastMode,
  }
}

/** One permission mode: label, one-line description, badge tone, and the bypass safety flags. */
const modeChoice = (value: ClaudePermissionMode) => ({
  value,
  labelKey: `claude:chat.permissionMode.${value}`,
  descriptionKey: `claude:chat.permissionModeHint.${value}`,
  ...PERMISSION_MODE_STYLE[value],
})

/** Every mode; `auto` only when the model supports it (or it is already on). */
function permissionDescriptor(models: ModelInfo[], state: ClaudeOptionState): ChatOptionDescriptor | undefined {
  if (state.permissionMode === null) return undefined
  const auto = currentModel(models, state.model)?.supportsAutoMode === true
  const offered = PERMISSION_MODES.filter(
    (m) => m !== PERMISSION_MODE.auto || auto || state.permissionMode === PERMISSION_MODE.auto,
  )
  return {
    key: CHAT_OPTION_KEYS.permissionMode,
    type: OPTION_TYPE.enum,
    labelKey: 'chat:option.permissionMode',
    values: offered.map(modeChoice),
    default: DEFAULT_PERMISSION_MODE,
    current: state.permissionMode,
  }
}

/** The modes a plan approval offers: `PLAN_APPROVE_MODES` the session currently describes. */
export function planModes(options: ChatOptionDescriptor[]): string[] {
  const offered = new Set(
    (options.find((o) => o.key === CHAT_OPTION_KEYS.permissionMode)?.values ?? []).map((v) => v.value),
  )
  return PLAN_APPROVE_MODES.filter((m) => offered.has(m))
}

/**
 * `model` (every supported model), `effort` (its levels, when the model has them), `fastMode` (when supported) and
 * `permissionMode` (unless the profile args set it).
 */
export function describeClaudeOptions(
  init: Pick<SDKControlInitializeResponse, 'models'>,
  state: ClaudeOptionState,
): ChatOptionDescriptor[] {
  const models = init.models ?? []
  return [
    modelDescriptor(models, state),
    effortDescriptor(models, state),
    fastModeDescriptor(models, state),
    permissionDescriptor(models, state),
  ].filter((d): d is ChatOptionDescriptor => d !== undefined)
}
