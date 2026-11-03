import { describe, expect, it } from 'vitest'
import { helpText, parseCli, UsageError } from '../src/args'

const COMMAND_LINES = [
  'pragma worktree list [--project <id>]',
  'pragma worktree create --branch <name> [--base <branch>] [--project <id>] [--path <dir>]',
  'pragma agent list [--worktree <id>]',
  'pragma agent spawn --profile <id|name> [--worktree <id>] [--prompt-file <path>]',
  'pragma agent profiles',
  'pragma task list [--project <id>] [--column <name>]',
  'pragma task create --title <t> [--description-file <path>] [--column <name>] [--priority <p>] [--labels a,b] [--project <id>]',
  'pragma task update <id> [--title <t>] [--description-file <path>] [--priority <p>] [--labels a,b]',
  'pragma task move <id> --column <name>',
  'pragma comments list [--worktree <id>]',
  'pragma handoff --to <profile> --file <path|-> [--branch <name>] [--base <branch>] [--same-worktree] [--task <id>]',
  'pragma ask --to <profile> [--prompt <text>] [--prompt-file <path|->] [--timeout <seconds>]',
]

describe('parseCli', () => {
  it('parses worktree list --json', () => {
    expect(parseCli(['worktree', 'list', '--json'])).toEqual({
      kind: 'call',
      method: 'worktreeList',
      json: true,
      options: {},
      positionals: [],
    })
  })

  it.each([
    [['worktree', 'create', '--branch', 'b', '--base', 'main'], 'worktreeCreate', { branch: 'b', base: 'main' }],
    [['agent', 'spawn', '--profile', 'OpenCode'], 'agentSpawn', { profile: 'OpenCode' }],
    [['agent', 'profiles'], 'profileList', {}],
    [['task', 'list', '--column', 'Review'], 'taskList', { column: 'Review' }],
    [['comments', 'list', '--worktree', 'w1'], 'commentsList', { worktree: 'w1' }],
    [['handoff', '--to', 'oc', '--file', '-'], 'handoff', { to: 'oc', file: '-' }],
  ])('maps %j to %s', (argv, method, options) => {
    expect(parseCli(argv)).toMatchObject({ kind: 'call', method, json: false, options })
  })

  it('parses task update with positional id', () => {
    const cmd = parseCli(['task', 'update', '42', '--title', 'x'])
    expect(cmd).toMatchObject({ method: 'taskUpdate', positionals: ['42'], options: { title: 'x' } })
  })

  it('labels split on comma and trimmed', () => {
    expect(parseCli(['task', 'create', '--title', 't', '--labels', 'a, b'])).toMatchObject({
      options: { labels: ['a', 'b'] },
    })
  })

  it('handoff --same-worktree is boolean', () => {
    const cmd = parseCli(['handoff', '--to', 'oc', '--file', 'h.md', '--same-worktree'])
    expect(cmd).toMatchObject({ options: { 'same-worktree': true } })
  })

  it.each([
    [
      ['handoff', '--to', 'oc', '--file', 'h.md', '--same-worktree', '--branch', 'x'],
      /--branch cannot be combined with --same-worktree/,
    ],
    [['task', 'move', '42'], /--column is required/],
    [['task', 'move', '--column', 'Done'], /<id> is required/],
    [['task', 'move', '1', '2', '--column', 'Done'], /Unexpected argument '2'/],
    [['worktree', 'list', '--nope'], /Unknown option '--nope'/],
    [['worktree', 'list', 'extra'], /Unexpected argument 'extra'/],
    [
      ['task', 'create', '--title', 't', '--priority', 'p1'],
      /--priority must be one of: none, low, medium, high, urgent/,
    ],
    [['comments', 'list', '--status', 'sent'], /Unknown option '--status'/],
    [['nope'], /Unknown command 'nope'/],
    [['worktree'], /Unknown or missing subcommand for 'worktree'. Expected one of: list, create/],
    [['task', 'create', '--title'], /--title/],
  ])('usage error for %j', (argv, message) => {
    expect(() => parseCli(argv)).toThrow(UsageError)
    expect(() => parseCli(argv)).toThrow(message)
  })

  it.each([
    [[], { kind: 'help' }],
    [['-h'], { kind: 'help' }],
    [['--help'], { kind: 'help' }],
    [['worktree', '--help'], { kind: 'help', topic: 'worktree' }],
    [['task', 'move', '-h'], { kind: 'help', topic: 'task' }],
    [['--version'], { kind: 'version' }],
  ])('%j → %j', (argv, expected) => {
    expect(parseCli(argv)).toEqual(expected)
  })
})

describe('parseCli ask', () => {
  it('maps --to and --prompt', () => {
    expect(parseCli(['ask', '--to', 'opencode', '--prompt', 'q'])).toEqual({
      kind: 'call',
      method: 'ask',
      json: false,
      options: { to: 'opencode', prompt: 'q' },
      positionals: [],
    })
  })

  it('--timeout is a number', () => {
    expect(parseCli(['ask', '--to', 'oc', '--prompt-file', '-', '--timeout', '90'])).toMatchObject({
      options: { to: 'oc', 'prompt-file': '-', timeout: 90 },
    })
  })

  it.each([
    [
      ['ask', '--to', 'oc', '--prompt', 'q', '--timeout', '0'],
      /--timeout must be a whole number of seconds from 1 to 3600/,
    ],
    [['ask', '--to', 'oc', '--prompt', 'q', '--timeout', 'abc'], /--timeout must be a whole number/],
    [['ask', '--to', 'oc', '--prompt', 'q', '--timeout', '3601'], /--timeout must be a whole number/],
    [['ask', '--to', 'oc', '--prompt', 'q', '--timeout', '1.5'], /--timeout must be a whole number/],
    [['ask', '--to', 'oc', '--prompt', 'q', '--prompt-file', 'f'], /--prompt cannot be combined with --prompt-file/],
    [['ask', '--to', 'oc'], /Pass one of --prompt, --prompt-file\./],
    [['ask', '--to', 'oc', '--prompt', '  '], /--prompt is empty/],
    [['ask', '--prompt', 'q'], /--to is required/],
  ])('usage error for %j', (argv, message) => {
    expect(() => parseCli(argv)).toThrow(UsageError)
    expect(() => parseCli(argv)).toThrow(message)
  })
})

describe('helpText', () => {
  it.each(COMMAND_LINES)('lists %s', (line) => {
    expect(helpText()).toContain(line)
  })

  it('topic help lists only that group', () => {
    const text = helpText('task')
    expect(text).toContain('pragma task move <id> --column <name>')
    expect(text).not.toContain('pragma worktree list')
  })
})
