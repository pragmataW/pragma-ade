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
  'pragma comments list [--worktree <id>] [--status <open|resolved|all>]',
  'pragma comments show <id>',
  'pragma comments reply <id> [--body <text>] [--file <path|->]',
  'pragma comments resolve <id> [--body <text>]',
  'pragma comments reopen <id>',
  'pragma handoff --to <profile> --file <path|-> [--branch <name>] [--base <branch>] [--same-worktree] [--task <id>]',
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
    [['comments', 'list', '--status', 'all'], 'commentsList', { status: 'all' }],
    [['comments', 'reply', 'c1', '--body', 'Done.'], 'commentsReply', { body: 'Done.' }],
    [['comments', 'reply', 'c1', '--file', '-'], 'commentsReply', { file: '-' }],
    [['comments', 'resolve', 'c1', '--body', 'Fixed.'], 'commentsResolve', { body: 'Fixed.' }],
    [['comments', 'reopen', 'c1'], 'commentsReopen', {}],
    [['handoff', '--to', 'oc', '--file', '-'], 'handoff', { to: 'oc', file: '-' }],
  ])('maps %j to %s', (argv, method, options) => {
    expect(parseCli(argv)).toMatchObject({ kind: 'call', method, json: false, options })
  })

  it('parses task update with positional id', () => {
    const cmd = parseCli(['task', 'update', '42', '--title', 'x'])
    expect(cmd).toMatchObject({ method: 'taskUpdate', positionals: ['42'], options: { title: 'x' } })
  })

  it('comments show takes the thread id as positional', () => {
    expect(parseCli(['comments', 'show', 'abc'])).toMatchObject({ method: 'commentsShow', positionals: ['abc'] })
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
    [['comments', 'list', '--status', 'bogus'], /--status must be one of: open, resolved, all/],
    [['comments', 'reply', 'c1'], /--body or --file is required/],
    [['comments', 'reply', 'c1', '--body', 'a', '--file', 'b'], /--body cannot be combined with --file/],
    [['comments', 'resolve'], /<id> is required/],
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
