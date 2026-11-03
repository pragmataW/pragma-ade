import { type CliMethod, MAX_DOCUMENT_BYTES } from '@pragma/module-cli-integration/contract'
import { describe, expect, it } from 'vitest'
import { UsageError } from '../src/args'
import { AppError } from '../src/client'
import { NotRunningError } from '../src/connection'
import { formatError, formatResult, formatTable } from '../src/output'

const worktree = { id: 'w1', projectId: 'p1', branch: 'main', path: '/repo', isMain: true }
const session = {
  id: 's1',
  worktreeId: 'w1',
  profileId: 'p1',
  profileName: 'OpenCode',
  status: 'idle',
  title: 'Fix',
  createdAt: 1,
}
const task = {
  id: 42,
  key: 'PRA-42',
  projectId: 'p1',
  title: 'Fix login',
  column: 'Review',
  priority: 'high',
  labels: ['ui'],
  worktreeId: null,
  sessionIds: [],
}
const comment = {
  id: 'c1',
  worktreeId: 'w1',
  source: 'editor',
  status: 'open',
  filePath: 'src/a.ts',
  lineStart: 3,
  lineEnd: 5,
  diffSide: null,
  snippet: null,
  selector: null,
  url: null,
  body: 'Rename this',
  round: 1,
  resolvedAt: null,
  replies: [],
  createdAt: 1,
  text: '[open] c1 `src/a.ts:3-5` (editor)\n   User: Rename this',
}
const list = (comments: unknown[], status = 'open') => ({ worktreeId: 'w1', round: 2, status, comments })

const TABLES: [CliMethod, unknown, string[]][] = [
  ['worktreeList', { projectId: 'p1', worktrees: [worktree] }, ['ID', 'BRANCH', 'PATH', 'main *', '/repo']],
  ['agentList', { worktreeId: 'w1', sessions: [session] }, ['PROFILE', 'STATUS', 'OpenCode', 'idle', 'Fix']],
  [
    'profileList',
    { profiles: [{ id: 'p1', name: 'OpenCode', providerId: 'opencode', enabled: true, isDefault: false }] },
    ['NAME', 'PROVIDER', 'ENABLED', 'DEFAULT', 'yes', 'no'],
  ],
  ['taskList', { projectId: 'p1', tasks: [task] }, ['COLUMN', 'PRIORITY', '42', 'PRA-42', 'Review', 'Fix login']],
  [
    'taskColumns',
    { projectId: 'p1', columns: [{ id: 4, name: 'Review', description: 'Needs\n  review', taskCount: 2 }] },
    ['NAME', 'TASKS', 'DESCRIPTION', 'Review', 'Needs review', '2'],
  ],
  ['taskCreate', task, ['title: Fix login', 'labels: ui', 'worktreeId: -']],
  [
    'handoff',
    { worktree, createdWorktree: true, session, taskId: null, sourceTaskIds: [] },
    ['Handed off to OpenCode in main (/repo), session s1'],
  ],
]

describe('formatResult', () => {
  it.each(TABLES)('%s human output', (method, result, parts) => {
    const text = formatResult(method, result, false)
    for (const part of parts) expect(text).toContain(part)
  })

  it('json success envelope', () => {
    const result = { profiles: [] }
    expect(formatResult('profileList', result, true)).toBe(`${JSON.stringify({ ok: true, result }, null, 2)}\n`)
  })

  it('taskShow prints the fields, then the description markdown verbatim', () => {
    const detail = {
      ...task,
      worktreeId: 'w2',
      description: '# Goal\n- [ ] x',
      columnDescription: 'Needs my review',
      worktreeBranch: 'feat/pra-42',
      createdAt: 1,
      updatedAt: 2,
    }
    const lines = formatResult('taskShow', detail, false).split('\n')
    for (const line of ['column: Review', 'column description: Needs my review', 'worktree: feat/pra-42 (w2)'])
      expect(lines).toContain(line)
    expect(lines.slice(lines.indexOf('description:') + 1, -1)).toEqual(['# Goal', '- [ ] x'])
  })

  it('taskShow without a description says so and omits an empty column description', () => {
    const detail = {
      ...task,
      description: ' ',
      columnDescription: '',
      worktreeBranch: null,
      createdAt: 1,
      updatedAt: 2,
    }
    const text = formatResult('taskShow', detail, false)
    expect(text).toContain('(no description)')
    expect(text).toContain('worktree: -')
    expect(text).not.toContain('column description')
  })

  const answered = {
    status: 'answered',
    askId: 'a1',
    profile: { id: 'oc', name: 'OpenCode', providerId: 'opencode' },
    text: 'The answer.',
    truncated: false,
    durationMs: 9,
  }

  it.each(['ask', 'askWait'] as const)('%s prints only the answer text, newline-terminated', (method) => {
    expect(formatResult(method, answered, false)).toBe('The answer.\n')
    expect(formatResult(method, { ...answered, text: 'Done.\n' }, false)).toBe('Done.\n')
  })

  it('a truncated answer says so', () => {
    expect(formatResult('ask', { ...answered, truncated: true }, false)).toBe(
      `The answer.\n\n[answer truncated at ${MAX_DOCUMENT_BYTES} bytes]\n`,
    )
  })

  it('a pending ask prints nothing', () => {
    expect(formatResult('ask', { status: 'pending', askId: 'a1' }, false)).toBe('')
  })

  it('comments list prints a header and every thread text', () => {
    expect(formatResult('commentsList', list([comment, { ...comment, id: 'c2', text: 'second' }]), false)).toBe(
      `Review round 2 · 2 open threads\n\n${comment.text}\n\nsecond\n`,
    )
    expect(formatResult('commentsList', list([comment], 'all'), false)).toContain('Review round 2 · 1 thread\n')
  })

  it.each([
    ['open', 'No open review threads.\n'],
    ['resolved', 'No resolved review threads.\n'],
    ['all', 'No review threads.\n'],
  ])('empty %s list', (status, text) => {
    expect(formatResult('commentsList', list([], status), false)).toBe(text)
  })

  it.each([
    ['commentsShow', `${comment.text}\n`],
    ['commentsReply', 'Replied to c1.\n'],
    ['commentsResolve', 'Resolved c1.\n'],
    ['commentsReopen', 'Reopened c1.\n'],
  ] as const)('%s prints one line', (method, text) => {
    expect(formatResult(method, comment, false)).toBe(text)
  })
})

describe('formatError', () => {
  it('json error envelope goes to stdout with exit 1', () => {
    const out = formatError(new AppError('not_found', 'x'), true)
    expect(out).toMatchObject({ exitCode: 1, stream: 'stdout' })
    expect(JSON.parse(out.text)).toEqual({ ok: false, error: { code: 'not_found', message: 'x' } })
  })

  it.each([
    [
      new NotRunningError('no info', 'the hint'),
      3,
      /^Pragma ADE is not running\. Start the app and try again\.\nthe hint/,
    ],
    [new UsageError('--column is required.'), 2, /--column is required\.\nRun 'pragma --help' for usage\./],
    [new AppError('conflict', 'Branch exists.'), 1, /Branch exists\./],
    [new Error('boom'), 1, /boom/],
  ])('human %s → stderr, exit %i', (err, exitCode, text) => {
    const out = formatError(err, false)
    expect(out).toMatchObject({ exitCode, stream: 'stderr' })
    expect(out.text).toMatch(text)
  })

  it.each([
    [new NotRunningError('no info'), 'not_running'],
    [new UsageError('bad'), 'usage'],
    [new Error('boom'), 'internal'],
  ])('json code for %s is %s', (err, code) => {
    expect(JSON.parse(formatError(err, true).text).error.code).toBe(code)
  })

  it('ambiguous errors list the candidates', () => {
    const candidates = [
      { id: 'a', name: 'Claude', providerId: 'claude', enabled: true, isDefault: true },
      { id: 'b', name: 'Claude', providerId: 'custom', enabled: true, isDefault: false },
    ]
    const text = formatError(new AppError('ambiguous', 'Two profiles.', { candidates }), false).text
    expect(text).toContain('a')
    expect(text).toContain('custom')
  })
})

describe('formatTable', () => {
  it('pads columns to the widest cell', () => {
    expect(formatTable(['A', 'B'], [['xxx', 'y']])).toBe('A    B\nxxx  y\n')
  })
})
