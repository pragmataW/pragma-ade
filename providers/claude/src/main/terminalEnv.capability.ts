import { TERMINAL_ENV_CAPABILITY, type TerminalEnvCapability } from '@pragma/module-terminal/contract'
import { defineCapability } from '@pragma/sdk'
import { CLAUDE_INHERITED_ENV, PROVIDER_ID } from '../constants'

/** Pragma's ptys (plain shells and agent sessions) drop a parent Claude session's stamps, so `claude` saves transcripts. */
export const terminalEnvCapability: TerminalEnvCapability = { inheritedEnvKeys: CLAUDE_INHERITED_ENV }

export default defineCapability(PROVIDER_ID, TERMINAL_ENV_CAPABILITY, terminalEnvCapability)
