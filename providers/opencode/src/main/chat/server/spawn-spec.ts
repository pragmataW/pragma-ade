import { createHash, randomBytes } from 'node:crypto'
import type { AgentProfile } from '@pragma/module-agents/contract'
import { ChatStartupError } from '@pragma/module-chat/contract'
import { OPENCODE_CONFIG_ENV as CONFIG_CONTENT_ENV, PLUGINS_KEY } from '../../status/constants'
import {
  ALT_PASSWORD_ENV,
  BASIC_SCHEME,
  BASIC_USER,
  HASH_ALGORITHM,
  HASH_ENCODING,
  PASSWORD_BYTES,
  PASSWORD_ENCODING,
  PASSWORD_ENV,
  REASON,
  SERVE_ARGS,
  SESSION_SCOPED_ENV,
} from '../constants'

export interface ServeSpec {
  command: string
  args: string[]
  env: Record<string, string>
  cwd: string
  password: string
}

const STRIPPED = new Set<string>([...SESSION_SCOPED_ENV, ALT_PASSWORD_ENV, PASSWORD_ENV])

type Json = Record<string, unknown>
const parseObject = (text: string): Json | null => {
  try {
    const v: unknown = JSON.parse(text)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null
  } catch {
    return null
  }
}

/**
 * The phase-04 status plugin is not loaded into a chat `serve` (one server hosts many sessions; 11a reports chat
 * status): its directory is removed from `OPENCODE_CONFIG_CONTENT.plugins`, and the variable dropped if nothing is left.
 */
export function withoutStatusPlugin(
  env: Record<string, string>,
  pluginDir: string | undefined,
): Record<string, string> {
  const raw = env[CONFIG_CONTENT_ENV]
  const doc = pluginDir && raw ? parseObject(raw) : null
  const plugins = doc?.[PLUGINS_KEY]
  if (!doc || !Array.isArray(plugins) || !plugins.includes(pluginDir)) return env
  const rest = plugins.filter((p) => p !== pluginDir)
  const { [PLUGINS_KEY]: _plugins, ...others } = doc
  const next = rest.length ? { ...others, [PLUGINS_KEY]: rest } : others
  const { [CONFIG_CONTENT_ENV]: _old, ...without } = env
  return Object.keys(next).length ? { ...without, [CONFIG_CONTENT_ENV]: JSON.stringify(next) } : without
}

export const newPassword = (): string => randomBytes(PASSWORD_BYTES).toString(PASSWORD_ENCODING)
export const basicAuthHeader = (password: string): string =>
  `${BASIC_SCHEME} ${Buffer.from(`${BASIC_USER}:${password}`).toString('base64')}`

/**
 * `<command> [profile args] serve --stdio --hostname 127.0.0.1 --port 0` in the worktree. The env is 11a's full child
 * env (shell + profile + decorators, never re-merged) minus session-scoped stamps, plus our own server password.
 */
export function buildServeSpec(o: {
  profile: Pick<AgentProfile, 'command' | 'args'>
  worktreePath: string
  env: Record<string, string>
  password?: string
  statusPluginDir?: string
}): ServeSpec {
  const command = o.profile.command.trim()
  if (!command) throw new ChatStartupError(REASON.emptyCommand)
  const password = o.password ?? newPassword()
  const env = Object.fromEntries(
    Object.entries(withoutStatusPlugin(o.env, o.statusPluginDir)).filter(([k]) => !STRIPPED.has(k)),
  )
  return {
    command,
    args: [...o.profile.args, ...SERVE_ARGS],
    env: { ...env, [PASSWORD_ENV]: password },
    cwd: o.worktreePath,
    password,
  }
}

/** Pool key: same worktree, profile, command line and env (without our password) share one server. */
export function serverKey(spec: ServeSpec, profileId: string): string {
  const env = Object.entries(spec.env)
    .filter(([k]) => k !== PASSWORD_ENV)
    .sort(([a], [b]) => a.localeCompare(b))
  const material = JSON.stringify([spec.cwd, profileId, spec.command, spec.args, env])
  return createHash(HASH_ALGORITHM).update(material).digest(HASH_ENCODING)
}
