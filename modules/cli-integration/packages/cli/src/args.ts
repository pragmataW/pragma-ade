import { type ParseArgsConfig, parseArgs } from 'node:util'
import { CLI_PRIORITIES, type CliMethod } from '@pragma/module-cli-integration/contract'
import { CLI_NAME, GLOBAL_HELP, HELP_FLAGS, LIST_SEPARATOR, VERSION_FLAG } from './constants'

export type OptionValue = string | boolean | string[]
export const COMMAND_KIND = { help: 'help', version: 'version', call: 'call' } as const
export type ParsedCommand =
  | { kind: typeof COMMAND_KIND.help; topic?: string }
  | { kind: typeof COMMAND_KIND.version }
  | {
      kind: typeof COMMAND_KIND.call
      method: CliMethod
      json: boolean
      options: Record<string, OptionValue>
      positionals: string[]
    }
export type CallCommand = Extract<ParsedCommand, { kind: typeof COMMAND_KIND.call }>

/** Bad command line: exit code 2. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UsageError'
  }
}

/**
 * One line per command; it is the single source for parsing and help. `--x <v>` takes a value, `--x` is a switch,
 * `[…]` is optional, a bare `<id>` after the subcommand is a required positional.
 */
const COMMAND_TABLE: readonly (readonly [string, CliMethod])[] = [
  ['worktree list [--project <id>]', 'worktreeList'],
  ['worktree create --branch <name> [--base <branch>] [--project <id>] [--path <dir>]', 'worktreeCreate'],
  ['agent list [--worktree <id>]', 'agentList'],
  ['agent spawn --profile <id|name> [--worktree <id>] [--prompt-file <path>]', 'agentSpawn'],
  ['agent profiles', 'profileList'],
  ['task list [--project <id>] [--column <name>]', 'taskList'],
  [
    'task create --title <t> [--description-file <path>] [--column <name>] [--priority <p>] [--labels a,b] [--project <id>]',
    'taskCreate',
  ],
  ['task update <id> [--title <t>] [--description-file <path>] [--priority <p>] [--labels a,b]', 'taskUpdate'],
  ['task move <id> --column <name>', 'taskMove'],
  ['comments list [--worktree <id>]', 'commentsList'],
  [
    'handoff --to <profile> --file <path|-> [--branch <name>] [--base <branch>] [--same-worktree] [--task <id>]',
    'handoff',
  ],
]

const OPTION_RE = /(?<optional>\[)?--(?<name>[a-z][a-z-]*)(?<value> [^\s\]]+)?\]?/g
const WORD_RE = /^[a-z]+$/
const POSITIONAL_RE = /^<([a-z]+)>$/
const LIST_OPTIONS = new Set(['labels'])
const CHOICES: Record<string, readonly string[]> = { priority: CLI_PRIORITIES }
/** Option pairs that exclude each other: `[a, b]` → "--a cannot be combined with --b". */
const EXCLUSIVE: readonly (readonly [string, string])[] = [['branch', 'same-worktree']]
const STRING_TYPE = 'string'
const BOOLEAN_TYPE = 'boolean'
const JSON_FLAG = 'json'
const PARSE_ERROR_END = '. '
const LIST_JOIN = ', '

interface CommandSpec {
  path: string[]
  usage: string
  method: CliMethod
  positional: string | undefined
  options: { name: string; takesValue: boolean; required: boolean }[]
}

function specOf([usage, method]: readonly [string, CliMethod]): CommandSpec {
  const words = usage.split(' ')
  const end = words.findIndex((w) => !WORD_RE.test(w))
  const path = end < 0 ? words : words.slice(0, end)
  const positional = POSITIONAL_RE.exec(words[path.length] ?? '')?.[1]
  const options = [...usage.matchAll(OPTION_RE)].map(({ groups }) => ({
    name: groups?.name as string,
    takesValue: groups?.value !== undefined,
    required: groups?.optional === undefined,
  }))
  return { path, usage, method, positional, options }
}

const COMMANDS = COMMAND_TABLE.map(specOf)
const GROUPS = [...new Set(COMMANDS.map((c) => c.path[0] as string))]

const usageLine = (c: CommandSpec): string => `  ${CLI_NAME} ${c.usage}`

/** Full help, or the commands of one group. */
export function helpText(topic?: string): string {
  const commands = COMMANDS.filter((c) => topic === undefined || c.path[0] === topic)
  return [...commands.map(usageLine), '', GLOBAL_HELP, ''].join('\n')
}

function findCommand(argv: string[]): CommandSpec {
  const group = argv[0] as string
  const inGroup = COMMANDS.filter((c) => c.path[0] === group)
  if (inGroup.length === 0) throw new UsageError(`Unknown command '${group}'.`)
  const match = inGroup.find((c) => c.path.every((w, i) => argv[i] === w))
  if (match) return match
  const subs = inGroup.map((c) => c.path[1]).join(LIST_JOIN)
  throw new UsageError(`Unknown or missing subcommand for '${group}'. Expected one of: ${subs}.`)
}

function parseConfig(spec: CommandSpec, args: string[]): ParseArgsConfig {
  const options: NonNullable<ParseArgsConfig['options']> = { [JSON_FLAG]: { type: BOOLEAN_TYPE } }
  for (const o of spec.options) options[o.name] = { type: o.takesValue ? STRING_TYPE : BOOLEAN_TYPE }
  return { args, options, strict: true, allowPositionals: true }
}

function runParseArgs(config: ParseArgsConfig): ReturnType<typeof parseArgs> {
  try {
    return parseArgs(config)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const end = message.indexOf(PARSE_ERROR_END)
    throw new UsageError(end < 0 ? message : message.slice(0, end + 1))
  }
}

function checkPositionals(spec: CommandSpec, positionals: string[]): void {
  const max = spec.positional ? 1 : 0
  if (positionals.length > max) throw new UsageError(`Unexpected argument '${positionals[max]}'.`)
  if (spec.positional && positionals.length === 0) throw new UsageError(`<${spec.positional}> is required.`)
}

function normalizeOption(name: string, value: string | boolean): OptionValue {
  const choices = CHOICES[name]
  if (choices && !choices.includes(String(value)))
    throw new UsageError(`--${name} must be one of: ${choices.join(LIST_JOIN)}.`)
  if (!LIST_OPTIONS.has(name) || typeof value !== STRING_TYPE) return value
  return String(value)
    .split(LIST_SEPARATOR)
    .map((s) => s.trim())
    .filter(Boolean)
}

function collectOptions(spec: CommandSpec, values: Record<string, unknown>): Record<string, OptionValue> {
  const options: Record<string, OptionValue> = {}
  for (const o of spec.options) {
    const value = values[o.name] as string | boolean | undefined
    if (value === undefined) {
      if (o.required) throw new UsageError(`--${o.name} is required.`)
      continue
    }
    options[o.name] = normalizeOption(o.name, value)
  }
  for (const [a, b] of EXCLUSIVE)
    if (options[a] !== undefined && options[b] !== undefined)
      throw new UsageError(`--${a} cannot be combined with --${b}.`)
  return options
}

/** argv (without node and script) → a command; throws `UsageError`. */
export function parseCli(argv: string[]): ParsedCommand {
  if (argv.length === 0) return { kind: COMMAND_KIND.help }
  if (argv.some((a) => HELP_FLAGS.includes(a))) {
    const topic = GROUPS.find((g) => g === argv[0])
    return topic ? { kind: COMMAND_KIND.help, topic } : { kind: COMMAND_KIND.help }
  }
  if (argv.includes(VERSION_FLAG)) return { kind: COMMAND_KIND.version }
  const spec = findCommand(argv)
  const { values, positionals } = runParseArgs(parseConfig(spec, argv.slice(spec.path.length)))
  checkPositionals(spec, positionals)
  const options = collectOptions(spec, values)
  return { kind: COMMAND_KIND.call, method: spec.method, json: values[JSON_FLAG] === true, options, positionals }
}
