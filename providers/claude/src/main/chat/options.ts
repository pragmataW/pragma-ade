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
  BYPASS_PERMISSIONS,
  DEFAULT_MODEL_VALUE,
  DEFAULT_PERMISSION_MODE,
  EFFORT_LEVELS,
  FLAG_VALUE_SEPARATOR,
  PERMISSION_FLAGS,
  PERMISSION_MODES,
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
}

const asString = (v: ChatOptionValue | undefined): string | null => (typeof v === 'string' ? v : null)

export function initialOptionState(ctx: Pick<ChatSessionContext, 'initialOptions' | 'profile'>): ClaudeOptionState {
  const o = ctx.initialOptions ?? {}
  const permission = hasPermissionFlag(ctx.profile.args)
    ? null
    : (asString(o.permissionMode) ?? DEFAULT_PERMISSION_MODE)
  return { model: asString(o.model), effort: asString(o.effort), permissionMode: permission }
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

function currentModel(models: ModelInfo[], model: string | null): ModelInfo | undefined {
  return models.find((m) => m.value === model) ?? models.find((m) => m.value === DEFAULT_MODEL_VALUE) ?? models[0]
}

function effortDescriptor(models: ModelInfo[], state: ClaudeOptionState): ChatOptionDescriptor | undefined {
  const model = currentModel(models, state.model)
  if (!model?.supportsEffort) return undefined
  const supported = new Set<string>(model.supportedEffortLevels ?? EFFORT_LEVELS)
  const values = EFFORT_LEVELS.filter((l) => supported.has(l)).map((value) => ({ value, label: value }))
  return {
    key: CHAT_OPTION_KEYS.effort,
    type: OPTION_TYPE.enum,
    labelKey: 'chat:option.effort',
    values: [DEFAULT_CHOICE, ...values],
    default: null,
    current: state.effort,
  }
}

const permissionLabelKey = (mode: string) => `claude:chat.permissionMode.${mode}`

/** `model` (init models), `effort` (when the model supports it), `permissionMode` (unless the args set it). */
export function describeClaudeOptions(
  init: Pick<SDKControlInitializeResponse, 'models'>,
  state: ClaudeOptionState,
): ChatOptionDescriptor[] {
  const models = init.models ?? []
  const model: ChatOptionDescriptor = {
    key: CHAT_OPTION_KEYS.model,
    type: OPTION_TYPE.enum,
    labelKey: 'chat:option.model',
    values: [DEFAULT_CHOICE, ...models.map((m) => ({ value: m.value, label: m.displayName }))],
    default: null,
    current: state.model,
  }
  const effort = effortDescriptor(models, state)
  const permission: ChatOptionDescriptor | undefined =
    state.permissionMode === null
      ? undefined
      : {
          key: CHAT_OPTION_KEYS.permissionMode,
          type: OPTION_TYPE.enum,
          labelKey: 'chat:option.permissionMode',
          values: PERMISSION_MODES.map((value) => ({
            value,
            labelKey: permissionLabelKey(value),
            ...(value === BYPASS_PERMISSIONS ? { warn: true } : {}),
          })),
          default: DEFAULT_PERMISSION_MODE,
          current: state.permissionMode,
        }
  return [model, effort, permission].filter((d): d is ChatOptionDescriptor => d !== undefined)
}
