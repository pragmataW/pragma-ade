/**
 * Literals shared by the `pragma` CLI and the main side (§9.2). Bridge env names come from `BRIDGE_ENV`
 * (`@pragma/module-bridge`), session/worktree env names from `AGENT_ENV` (`@pragma/module-agents`); never redeclared.
 */
export const CLI_MODULE_ID = 'cli-integration'

/** Absolute path of the generated shim (set on every agent launch). */
export const ENV_CLI = 'PRAGMA_CLI'
/** Overrides the bundle location (tests, custom builds). */
export const ENV_CLI_BUNDLE = 'PRAGMA_CLI_BUNDLE'

export const EXIT_CODES = { ok: 0, appError: 1, usage: 2, notRunning: 3 } as const
export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES]

const KIB = 1024
const MAX_DOCUMENT_KIB = 256
/** Upper bound for `--file`, `--prompt-file` and `--description-file` contents (UTF-8 bytes). */
export const MAX_DOCUMENT_BYTES = MAX_DOCUMENT_KIB * KIB

export const CLI_BIN_NAME = 'pragma'
export const CLI_CMD_SHIM_NAME = 'pragma.cmd'

/** Source folder names under `skills/`. */
export const SKILL_IDS = ['ask', 'board', 'handoff', 'pragma-cli'] as const
export type SkillId = (typeof SKILL_IDS)[number]
/** Directory (and frontmatter `name`) each skill is installed as. */
export const SKILL_INSTALL_NAMES: Record<SkillId, string> = {
  ask: 'pragma-ask',
  board: 'pragma-board',
  handoff: 'pragma-handoff',
  'pragma-cli': 'pragma-cli',
}
export const SKILL_FILE = 'SKILL.md'

const SECONDS_PER_MINUTE = 60
const DEFAULT_ASK_MINUTES = 10
const MAX_ASK_MINUTES = 60
export const MS_PER_S = 1000
/** `pragma ask --timeout` default and upper bound (seconds). */
export const ASK_DEFAULT_TIMEOUT_SECONDS = DEFAULT_ASK_MINUTES * SECONDS_PER_MINUTE
export const ASK_MAX_TIMEOUT_SECONDS = MAX_ASK_MINUTES * SECONDS_PER_MINUTE
/** The app holds one `ask` / `askWait` request at most this long before answering "pending" (long-poll). */
export const ASK_POLL_WAIT_MS = 30_000
const ASK_REQUEST_MARGIN_MS = 15_000
/** Per-request HTTP timeout of `ask` / `askWait` (well below fetch's and node:http's 300 s limits). */
export const ASK_REQUEST_TIMEOUT_MS = ASK_POLL_WAIT_MS + ASK_REQUEST_MARGIN_MS
/** The CLI gives up this long after the question's own timeout. */
export const ASK_DEADLINE_MARGIN_MS = 30_000
