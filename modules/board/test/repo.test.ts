import { beforeEach, describe, expect, it } from 'vitest'
import { type BoardRepo, createBoardRepo } from '../src/main/repo'
import type { BoardRow, ColumnRow } from '../src/main/schema'
import { seedBoard, seedColumn, seedTask } from './support/builders'
import { openTestDb, type TestDb } from './support/db'

let t: TestDb
let repo: BoardRepo
let board: BoardRow
let todo: ColumnRow

beforeEach(async () => {
  t = await openTestDb()
  repo = createBoardRepo(t.opened.db)
  board = seedBoard(repo)
  todo = seedColumn(repo, board)
})

it('records migrations 0901 and 0902 once', async () => {
  await t.reopen()
  const rows = t.opened.sqlite.prepare("SELECT name FROM schema_migrations WHERE module = 'board'").all() as {
    name: string
  }[]
  expect(rows.map((r) => r.name)).toEqual(['0901_board.sql', '0902_board_column_description.sql'])
})

it('0902 adds an empty description to existing columns', async () => {
  const old = await openTestDb({ migrations: 1 })
  const sqlite = old.opened.sqlite
  const boardId = Number(
    sqlite
      .prepare("INSERT INTO board_boards (project_id, name, key_prefix, created_at) VALUES ('p9', 'old', 'OLD', 0)")
      .run().lastInsertRowid,
  )
  sqlite.prepare("INSERT INTO board_columns (board_id, name, sort_order) VALUES (?, 'Todo', 'a0')").run(boardId)
  await old.reopen()
  const columns = old.opened.sqlite.prepare('PRAGMA table_info(board_columns)').all() as { name: string }[]
  expect(columns.map((c) => c.name)).toContain('description')
  expect(createBoardRepo(old.opened.db).listColumns(boardId)[0]?.description).toBe('')
})

it('column names are unique per board, case-insensitively', () => {
  expect(() => seedColumn(repo, board, 'todo', 'a1')).toThrow()
})

it('nextTaskNumber counts 1, 2, 3', () => {
  const other = seedBoard(repo, { projectId: 'p2' })
  expect([1, 2, 3].map(() => repo.nextTaskNumber(other.id))).toEqual([1, 2, 3])
})

it('listTasks orders by sort key (code-unit order)', () => {
  for (const [title, sortOrder] of [
    ['C', 'a2'],
    ['A', 'a0'],
    ['B', 'a1'],
  ] as const)
    seedTask(repo, board, { columnId: todo.id, title, sortOrder })
  expect(repo.listTasks({ columnId: todo.id }).map((r) => r.title)).toEqual(['A', 'B', 'C'])
})

describe('session links', () => {
  it('insertSessionLink is idempotent and deleteTask removes links', () => {
    const task = seedTask(repo, board, { columnId: todo.id })
    repo.insertSessionLink(task.id, 's1', 1)
    repo.insertSessionLink(task.id, 's1', 2)
    expect(repo.listSessionLinks([task.id])).toHaveLength(1)
    expect(repo.listTaskIdsForSession('s1')).toEqual([task.id])
    repo.deleteTask(task.id)
    expect(repo.listSessionLinks([task.id])).toEqual([])
    expect(repo.getTask(task.id)).toBeUndefined()
  })
})

it('clearWorktree nulls the link and returns affected ids', () => {
  const a = seedTask(repo, board, { columnId: todo.id, worktreeId: 'w1' })
  seedTask(repo, board, { columnId: todo.id, worktreeId: 'w2' })
  expect(repo.clearWorktree('w1')).toEqual([a.id])
  expect(repo.getTask(a.id)?.worktreeId).toBeNull()
})

it('rejects an invalid priority (CHECK)', () => {
  expect(() =>
    t.opened.sqlite
      .prepare(
        "INSERT INTO board_tasks (board_id, number, column_id, title, priority, sort_order, created_at, updated_at) VALUES (?, 99, ?, 'x', 'bogus', 'a0', 0, 0)",
      )
      .run(board.id, todo.id),
  ).toThrow()
})

it('columnTaskKeys excludes the moving task', () => {
  const a = seedTask(repo, board, { columnId: todo.id, sortOrder: 'a0' })
  seedTask(repo, board, { columnId: todo.id, sortOrder: 'a1' })
  expect(repo.columnTaskKeys(todo.id, a.id)).toEqual(['a1'])
})
