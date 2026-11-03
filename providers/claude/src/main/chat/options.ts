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
  PERMISSION_FLAG,
  PERMISSION_MODE,
  PERMISSION_MODE_STYLE,
  PERMISSION_MODES,
  PLAN_APPROVE_MODES,
  REPLAY_USER_MESSAGES_FLAG,
  SYSTEM_PRESET,
} from './constants'
import { buildClaudeChildEnv } from './env'
import type { ClaudeProcessSpawn } from './spawn'

const MODES = new Set<string>(PERMISSION_MODES)
const isPermissionMode = (v: string | undefined): v is ClaudePermissionMode => v !== undefined && MODES.has(v)

export interface ProfilePermission {
  /** The mode the profile args ask for (the last permission flag wins), else `null`. */
  startMode: ClaudePermissionMode | null
  /** The profile args without any permission flag (and without the value of `--permission-mode <m>`). */
  args: string[]
}

/** Splits the permission flags (`--dangerously-skip-permissions`, `--permission-mode[=]<m>`, …) off profile args. */
export function splitPermissionArgs(args: readonly string[]): ProfilePermission {
  let startMode: ClaudePermissionMode | null = null
  const rest: string[] = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? ''
    const [flag, inline] = arg.split(FLAG_VALUE_SEPARATOR)
    if (flag === PERMISSION_FLAG.skip) startMode = PERMISSION_MODE.bypassPermissions
    else if (flag === PERMISSION_FLAG.mode) {
      const value = inline ?? args[++i]
      if (isPermissionMode(value)) startMode = value
    } else if (flag !== PERMISSION_FLAG.allowSkip) rest.push(arg)
  }
  return { startMode, args: rest }
}

export interface ClaudeOptionState {
  model: string | null
  effort: string | null
  permissionMode: string
  fastMode: boolean
}

const asString = (v: ChatOptionValue | undefined): string | null => (typeof v === 'string' ? v : null)

/** A saved choice (`initialOptions`) wins over the profile's permission flag, which wins over `default`. */
export function initialOptionState(ctx: Pick<ChatSessionContext, 'initialOptions' | 'profile'>): ClaudeOptionState {
  const o = ctx.initialOptions ?? {}
  return {
    model: asString(o.model),
    effort: asString(o.effort),
    permissionMode:
      asString(o.permissionMode) ?? splitPermissionArgs(ctx.profile.args).startMode ?? DEFAULT_PERMISSION_MODE,
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
    permissionMode: state.permissionMode as Options['permissionMode'],
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
function permissionDescriptor(models: ModelInfo[], state: ClaudeOptionState): ChatOptionDescriptor {
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
 * `permissionMode` (always; the profile's permission flag only picks the start mode).
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

/**
 * `defaultOptions`: what a fresh start of `profile` describes without a CLI to ask (no model list yet), i.e. the
 * permission picker in the mode the profile's args start in.
 */
export function defaultClaudeOptions(profile: ChatSessionContext['profile']): ChatOptionDescriptor[] {
  return [permissionDescriptor([], initialOptionState({ profile }))]
}
