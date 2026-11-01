/** Constants shared with other modules (§9); module-internal ones live in `../constants.ts`. */

/** Prompts longer than this go to a temp file and the agent gets a one-line instruction instead. */
export const INLINE_PROMPT_MAX_CHARS = 16_000
export const LONG_PROMPT_FILE = 'initial-prompt.md'
/** The first `major.minor.patch` in a version banner. */
export const SEMVER_RE = /(\d+)\.(\d+)\.(\d+)/

/** `{ a: 'a', … }` for an `as const` list, so code names members instead of repeating literals (§9). */
export const keyedEnum = <const T extends readonly string[]>(values: T): { readonly [K in T[number]]: K } =>
  Object.fromEntries(values.map((v) => [v, v])) as { readonly [K in T[number]]: K }

export const AGENTS_MODULE_ID = 'agents'
export const TERMINAL_MODE = 'terminal'
export const BUILTIN_PROFILE_PREFIX = 'builtin:'
/** Set by 03 on every launch (decorators add their own). */
export const AGENT_ENV = { sessionId: 'PRAGMA_SESSION_ID', worktreeId: 'PRAGMA_WORKTREE_ID' } as const
/** Profile env may not set these (they belong to the app and its decorators). */
export const RESERVED_ENV_PREFIX = 'PRAGMA_'
export const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/
export const NUL_CHAR = '\0'

export const AGENTS_IPC = {
  listProviders: 'agents.listProviders',
  listProfiles: 'agents.listProfiles',
  createProfile: 'agents.createProfile',
  updateProfile: 'agents.updateProfile',
  resetProfile: 'agents.resetProfile',
  setDefaultProfile: 'agents.setDefaultProfile',
  deleteProfile: 'agents.deleteProfile',
  resolveCommand: 'agents.resolveCommand',
  checkProfile: 'agents.checkProfile',
  listModes: 'agents.listModes',
  startSession: 'agents.startSession',
  relaunchSession: 'agents.relaunchSession',
  listSessions: 'agents.listSessions',
  getSession: 'agents.getSession',
  stopSession: 'agents.stopSession',
  closeSession: 'agents.closeSession',
  focusSession: 'agents.focusSession',
  newWorktreeDefaults: 'agents.newWorktreeDefaults',
} as const
/** Main → renderer IPC events. */
export const AGENTS_IPC_EVENTS = {
  profilesChanged: 'agents.profilesChanged',
  sessionChanged: 'agents.sessionChanged',
} as const
/** Main event bus names. */
export const AGENTS_EVENTS = {
  started: 'agentSession.started',
  exited: 'agentSession.exited',
  updated: 'agentSession.updated',
} as const
export const AGENTS_COMMANDS = {
  newSession: 'agents.newSession',
  focusSession: 'agents.focusSession',
  openLauncher: 'agents.openLauncher',
} as const
export const AGENT_SLOTS = {
  view: 'agentSession.view',
  tabBadges: 'agentSession.tab.badges',
  toolbar: 'agentSession.toolbar',
  launcherOptions: 'agentLauncher.options',
} as const
export const AGENTS_SERVICE_ID = 'agents.sessions'
export const AGENTS_VIEW_ID = 'agents'
export const PROFILE_NAME_MAX = 60
export const SESSION_TITLE_MAX = 200
