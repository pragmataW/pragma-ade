import { describe, expect, it } from 'vitest'
import {
  BOARD_TESTIDS,
  BoardCardBadgesPropsSchema,
  BoardError,
  BoardServiceToken,
  boardIpc,
  boardIpcEvents,
  CreateTaskInputSchema,
  DEFAULT_COLUMN_NAMES,
  IN_PROGRESS_COLUMN_NAME,
  StartInWorktreeInputSchema,
  TaskFilterSchema,
} from '../src/contract'

describe('CreateTaskInputSchema', () => {
  it('trims the title and rejects blank titles', () => {
    expect(CreateTaskInputSchema.parse({ projectId: 'p', title: '  Fix  ' }).title).toBe('Fix')
    expect(CreateTaskInputSchema.safeParse({ projectId: 'p', title: '   ' }).success).toBe(false)
  })
  it.each([3, 'In Progress'])('accepts column %s', (column) => {
    expect(CreateTaskInputSchema.parse({ projectId: 'p', title: 't', column }).column).toBe(column)
  })
})

it('default columns are verbatim and contain In Progress', () => {
  expect(DEFAULT_COLUMN_NAMES).toEqual(['Backlog', 'Todo', 'In Progress', 'Review', 'Done'])
  expect(DEFAULT_COLUMN_NAMES).toContain(IN_PROGRESS_COLUMN_NAME)
})

it('service token is board.service', () => {
  expect(BoardServiceToken.id).toBe('board.service')
})

describe('IPC contracts', () => {
  const channels = [...Object.values(boardIpc), ...Object.values(boardIpcEvents)].map((c) => c.channel)
  it('are board-scoped and unique', () => {
    for (const c of channels) expect(c.startsWith('board.')).toBe(true)
    expect(new Set(channels).size).toBe(channels.length)
  })
  it.each(['board.moveTask', 'board.startInNewWorktree', 'board.changedEvent', 'board.setColumnDescription'])(
    'include %s',
    (c) => {
      expect(channels).toContain(c)
    },
  )
})

it('filter and slot props accept session ids', () => {
  expect(TaskFilterSchema.parse({ sessionId: 's1' })).toEqual({ sessionId: 's1' })
  expect(BoardCardBadgesPropsSchema.parse({ taskId: 1, sessionIds: ['s1'] })).toEqual({ taskId: 1, sessionIds: ['s1'] })
})

it('sendPrompt is optional (the setting decides when omitted)', () => {
  expect(StartInWorktreeInputSchema.parse({ taskId: 1, worktreeId: 'w' }).sendPrompt).toBeUndefined()
})

describe('BOARD_TESTIDS', () => {
  const values = Object.values(BOARD_TESTIDS)
  it('are unique', () => expect(new Set(values).size).toBe(values.length))
  it.each(values)('%s is board/task scoped', (v) => expect(v).toMatch(/^(board|task)-[a-z-]+$/))
})

it('BoardError carries its code', () => {
  const e = new BoardError('last_column', 'x')
  expect(e.code).toBe('last_column')
  expect(e).toBeInstanceOf(Error)
})
