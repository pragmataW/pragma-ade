export const PROVIDER_ID = 'opencode'
export const DEFAULT_COMMAND = 'opencode'

/**
 * `pragma ask`: one headless question with the read-only built-in `plan` agent. `--standalone` gives the run a
 * private server, so killing it stops the turn; `--auto` is never passed (non-interactive runs reject permission
 * prompts on their own).
 */
export const ASK_RUN_ARGS = ['run', '--standalone', '--format', 'json', '--agent', 'plan'] as const
export const ASK_MODEL_FLAGS = ['--model', '-m'] as const
export const ASK_MODEL_FLAG = '-m'
export const ASK_FILE_FLAG = '--file'
export const ASK_PROMPT_FILE = 'question.md'
/** Fixed English (sent to the agent) when the question is too long for argv and travels as an attachment. */
export const ASK_FILE_MESSAGE = `The attached file ${ASK_PROMPT_FILE} is a question from another coding agent. Answer it.`
/** At most this much of stderr goes into a failure message. */
export const STDERR_TAIL_CHARS = 2000
