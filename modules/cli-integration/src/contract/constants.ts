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
export const SKILL_IDS = ['handoff', 'pragma-cli'] as const
export type SkillId = (typeof SKILL_IDS)[number]
/** Directory (and frontmatter `name`) each skill is installed as. */
export const SKILL_INSTALL_NAMES: Record<SkillId, string> = { handoff: 'pragma-handoff', 'pragma-cli': 'pragma-cli' }
export const SKILL_FILE = 'SKILL.md'
