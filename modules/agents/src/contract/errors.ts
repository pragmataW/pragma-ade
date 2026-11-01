import { keyedEnum } from './constants'

const AGENTS_ERROR_CODE_LIST = [
  'worktreeNotFound',
  'profileNotFound',
  'profileDisabled',
  'noDefaultProfile',
  'providerUnavailable',
  'modeUnavailable',
  'commandNotFound',
  'spawnFailed',
  'argsInvalid',
  'envInvalid',
  'cannotDeleteBuiltin',
  'cannotResetCustom',
  'cannotDisableDefault',
  'cannotDefaultDisabled',
  'sessionNotFound',
  'stopFailed',
  'worktreeCreateFailed',
] as const
export const agentsErrorCodes = AGENTS_ERROR_CODE_LIST
export type AgentsErrorCode = (typeof agentsErrorCodes)[number]
/** `AGENTS_ERROR.commandNotFound === 'commandNotFound'`. */
export const AGENTS_ERROR = keyedEnum(agentsErrorCodes)

const ERROR_KEY_PREFIX = 'agents:errors.'
const PARAMS_SEPARATOR = '|'
const ERROR_MESSAGE_RE = /^agents:errors\.([A-Za-z]+)(?:\|(.*))?$/s
const CODE_SET = new Set<string>(agentsErrorCodes)

export const agentsErrorI18nKey = (code: AgentsErrorCode): string => `${ERROR_KEY_PREFIX}${code}`

/** `agents:errors.<code>` plus `|{json params}` when there are params; survives any IPC serialization. */
function errorMessage(code: AgentsErrorCode, params: Record<string, string>): string {
  const key = agentsErrorI18nKey(code)
  return Object.keys(params).length > 0 ? `${key}${PARAMS_SEPARATOR}${JSON.stringify(params)}` : key
}

export class AgentsError extends Error {
  readonly code: AgentsErrorCode
  readonly params: Record<string, string>
  constructor(code: AgentsErrorCode, params: Record<string, string> = {}) {
    super(errorMessage(code, params))
    this.name = 'AgentsError'
    this.code = code
    this.params = params
  }
}

function parseParams(json: string | undefined): Record<string, string> {
  if (!json) return {}
  try {
    const value: unknown = JSON.parse(json)
    if (typeof value !== 'object' || value === null) return {}
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, String(v)]))
  } catch {
    return {}
  }
}

/** The i18n key and params carried by an `AgentsError` (also after IPC, where only the message survives). */
export function agentsErrorKey(e: unknown): { key: string; params: Record<string, string> } | null {
  const message = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
  const m = ERROR_MESSAGE_RE.exec(message)
  const [, code, params] = m ?? []
  if (!code || !CODE_SET.has(code)) return null
  return { key: `${ERROR_KEY_PREFIX}${code}`, params: parseParams(params) }
}

/** The error code of an `AgentsError`-shaped value, or null. */
export function agentsErrorCode(e: unknown): AgentsErrorCode | null {
  const parsed = agentsErrorKey(e)
  return parsed ? (parsed.key.slice(ERROR_KEY_PREFIX.length) as AgentsErrorCode) : null
}
