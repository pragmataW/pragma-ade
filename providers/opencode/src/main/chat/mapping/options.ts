import {
  CHAT_OPTION_KEYS,
  CHAT_TONE,
  type ChatOptionDescriptor,
  type ChatOptionValue,
  OPTION_TYPE,
  validateOptionValue,
} from '@pragma/module-chat/contract'
import {
  AGENT_MODES,
  AGENT_OPTION_KEY,
  AGENT_OPTION_LABEL_KEY,
  DEFAULT_AGENT,
  DEFAULT_VARIANT_LABEL_KEY,
  INVALID_OPTION,
  MODEL_REF_SEPARATOR,
  PERMISSION_MODE,
  PERMISSION_MODE_KEYS,
  type PERMISSION_MODES,
} from '../constants'
import type { AgentInfo, ModelInfo, ModelRef } from '../schemas'

const MODEL_LABEL_KEY = 'chat:option.model'
const EFFORT_LABEL_KEY = 'chat:option.effort'
const PERMISSION_LABEL_KEY = 'chat:option.permissionMode'

export type PermissionMode = (typeof PERMISSION_MODES)[number]

/**
 * The user's picks; `model` is `<providerID>/<id>`, `effort` a variant id (null = the model's default),
 * `permissionMode` whether permission requests are answered by the user (`ask`) or approved automatically (`auto`).
 */
export interface Selection {
  model?: string
  effort?: string | null
  agent?: string
  permissionMode?: PermissionMode
}

export interface Catalog {
  models: ModelInfo[]
  defaultModel: ModelInfo | null
  agents: AgentInfo[]
}

export const modelValue = (m: Pick<ModelRef, 'id' | 'providerID'>): string =>
  `${m.providerID}${MODEL_REF_SEPARATOR}${m.id}`

/** `<providerID>/<id>` → a model ref (the id may contain more slashes). */
export function modelRefOf(value: string): { providerID: string; id: string } {
  const at = value.indexOf(MODEL_REF_SEPARATOR)
  return { providerID: value.slice(0, at), id: value.slice(at + 1) }
}

/** The 2.x `model` body (`{id, providerID, variant?}`) for a selection, or undefined without a model. */
export function modelInputOf(sel: Selection): ModelRef | undefined {
  if (!sel.model) return undefined
  const ref = modelRefOf(sel.model)
  return sel.effort ? { ...ref, variant: sel.effort } : ref
}

const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label)

function modelDescriptor(c: Catalog, sel: Selection): ChatOptionDescriptor {
  const values = c.models
    .filter((m) => m.enabled !== false)
    .map((m) => ({ value: modelValue(m), label: m.name }))
    .sort(byLabel)
  const fallback = c.defaultModel ? modelValue(c.defaultModel) : (values[0]?.value ?? null)
  return {
    key: CHAT_OPTION_KEYS.model,
    type: OPTION_TYPE.enum,
    labelKey: MODEL_LABEL_KEY,
    values,
    default: fallback,
    current: sel.model ?? fallback,
  }
}

function agentDescriptor(c: Catalog, sel: Selection): ChatOptionDescriptor | null {
  const values = c.agents
    .filter((a) => (a.mode === AGENT_MODES.primary || a.mode === AGENT_MODES.all) && !a.hidden)
    .map((a) => ({ value: a.id, label: a.name, ...(a.description ? { description: a.description } : {}) }))
  if (values.length === 0) return null
  const fallback = values.some((v) => v.value === DEFAULT_AGENT) ? DEFAULT_AGENT : (values[0]?.value ?? null)
  return {
    key: AGENT_OPTION_KEY,
    type: OPTION_TYPE.enum,
    labelKey: AGENT_OPTION_LABEL_KEY,
    values,
    default: fallback,
    current: sel.agent ?? fallback,
  }
}

function effortDescriptor(model: ModelInfo | undefined, sel: Selection): ChatOptionDescriptor | null {
  if (!model?.variants.length) return null
  const values = [
    { value: null, labelKey: DEFAULT_VARIANT_LABEL_KEY },
    ...model.variants.map((v) => ({ value: v.id, label: v.id })),
  ]
  const current = sel.effort && model.variants.some((v) => v.id === sel.effort) ? sel.effort : null
  return {
    key: CHAT_OPTION_KEYS.effort,
    type: OPTION_TYPE.enum,
    labelKey: EFFORT_LABEL_KEY,
    values,
    default: null,
    current,
  }
}

/** `ask` (OpenCode's rules decide, risky actions ask) or `auto` (every request approved once, after a confirmation). */
function permissionDescriptor(sel: Selection): ChatOptionDescriptor {
  const { ask, auto } = PERMISSION_MODE
  return {
    key: CHAT_OPTION_KEYS.permissionMode,
    type: OPTION_TYPE.enum,
    labelKey: PERMISSION_LABEL_KEY,
    values: [
      {
        value: ask,
        labelKey: PERMISSION_MODE_KEYS.ask.label,
        descriptionKey: PERMISSION_MODE_KEYS.ask.description,
        tone: CHAT_TONE.info,
      },
      {
        value: auto,
        labelKey: PERMISSION_MODE_KEYS.auto.label,
        descriptionKey: PERMISSION_MODE_KEYS.auto.description,
        tone: CHAT_TONE.warn,
        warn: true,
        dangerous: true,
        requiresConfirm: true,
      },
    ],
    default: ask,
    current: sel.permissionMode ?? ask,
  }
}

/**
 * Permission mode, model (enabled, sorted), agent (primary, visible; default `build`), effort (only when the model
 * has variants).
 */
export function buildOptionDescriptors(c: Catalog, sel: Selection): ChatOptionDescriptor[] {
  const model = modelDescriptor(c, sel)
  const current = c.models.find((m) => modelValue(m) === model.current)
  return [permissionDescriptor(sel), model, agentDescriptor(c, sel), effortDescriptor(current, sel)].filter(
    (d): d is ChatOptionDescriptor => d !== null,
  )
}

export class InvalidOptionError extends Error {}

/** A validated selection change; switching the model clears the effort. */
export function applyOption(
  sel: Selection,
  key: string,
  value: ChatOptionValue,
  descriptors: ChatOptionDescriptor[],
): Selection {
  const d = descriptors.find((x) => x.key === key)
  if (!d || !validateOptionValue(d, value)) throw new InvalidOptionError(`${INVALID_OPTION} ${key}`)
  switch (key) {
    case CHAT_OPTION_KEYS.model:
      return { ...sel, model: String(value), effort: null }
    case CHAT_OPTION_KEYS.effort:
      return { ...sel, effort: value === null ? null : String(value) }
    case CHAT_OPTION_KEYS.permissionMode:
      return { ...sel, permissionMode: value === PERMISSION_MODE.auto ? PERMISSION_MODE.auto : PERMISSION_MODE.ask }
    default:
      return { ...sel, agent: String(value) }
  }
}

/** The model's context window, when known. */
export const contextWindowOf = (models: ModelInfo[], ref: Pick<ModelRef, 'id' | 'providerID'>): number | undefined =>
  models.find((m) => m.id === ref.id && m.providerID === ref.providerID)?.limit?.context
