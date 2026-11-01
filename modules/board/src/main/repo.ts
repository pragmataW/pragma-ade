import { and, asc, eq, inArray, type PragmaDb, sql } from '@pragma/sdk/db'
import {
  type BoardRow,
  boardBoards,
  boardColumns,
  boardLabels,
  boardTaskSessions,
  boardTasks,
  type ColumnRow,
  type LabelRow,
  type SessionLinkRow,
  type TaskInsert,
  type TaskRow,
} from './schema'

export interface TaskQuery {
  boardIds?: number[]
  columnId?: number
  worktreeId?: string
  taskIds?: number[]
}

type ColumnInsert = Omit<ColumnRow, 'id'>
type LabelInsert = Omit<LabelRow, 'id'>
type TaskPatch = Partial<Omit<TaskInsert, 'id' | 'boardId' | 'number' | 'createdAt'>>

/** Synchronous queries over the `board_*` tables (better-sqlite3 is synchronous). */
export interface BoardRepo {
  transaction<T>(fn: () => T): T
  findBoardByProject(projectId: string): BoardRow | undefined
  insertBoard(b: { projectId: string; name: string; keyPrefix: string; createdAt: number }): BoardRow
  /** Returns the next task number of the board and increments the counter. */
  nextTaskNumber(boardId: number): number
  listBoards(): BoardRow[]
  getBoard(id: number): BoardRow | undefined
  listColumns(boardId: number): ColumnRow[]
  getColumn(id: number): ColumnRow | undefined
  insertColumn(c: ColumnInsert): ColumnRow
  updateColumn(id: number, patch: Partial<ColumnInsert>): ColumnRow
  deleteColumn(id: number): void
  listLabels(boardId: number): LabelRow[]
  getLabel(id: number): LabelRow | undefined
  insertLabel(l: LabelInsert): LabelRow
  updateLabel(id: number, patch: Partial<LabelInsert>): LabelRow
  deleteLabel(id: number): void
  /** Ordered by column sort key, then task sort key (id breaks ties). */
  listTasks(q?: TaskQuery): TaskRow[]
  getTask(id: number): TaskRow | undefined
  getTaskByKey(boardId: number, number: number): TaskRow | undefined
  insertTask(t: Omit<TaskInsert, 'id'>): TaskRow
  updateTask(id: number, patch: TaskPatch): TaskRow
  /** Also removes its session links. */
  deleteTask(id: number): void
  columnTaskKeys(columnId: number, excludeTaskId?: number): string[]
  /** Unlinks the worktree from every task; returns the affected task ids. */
  clearWorktree(worktreeId: string): number[]
  listSessionLinks(taskIds: number[]): SessionLinkRow[]
  listTaskIdsForSession(sessionId: string): number[]
  insertSessionLink(taskId: number, sessionId: string, linkedAt: number): void
  deleteSessionLink(taskId: number, sessionId: string): void
}

class RowNotFoundError extends Error {}

function must<T>(row: T | undefined, what: string): T {
  if (row === undefined) throw new RowNotFoundError(`${what} not found`)
  return row
}

export function createBoardRepo(db: PragmaDb): BoardRepo {
  const tasksWhere = (q: TaskQuery) =>
    and(
      q.boardIds ? inArray(boardTasks.boardId, q.boardIds) : undefined,
      q.columnId !== undefined ? eq(boardTasks.columnId, q.columnId) : undefined,
      q.worktreeId !== undefined ? eq(boardTasks.worktreeId, q.worktreeId) : undefined,
      q.taskIds ? inArray(boardTasks.id, q.taskIds) : undefined,
    )
  return {
    transaction: (fn) => db.transaction(() => fn()),
    findBoardByProject: (projectId) => db.select().from(boardBoards).where(eq(boardBoards.projectId, projectId)).get(),
    insertBoard: (b) =>
      db
        .insert(boardBoards)
        .values({ ...b, nextNumber: 1 })
        .returning()
        .get(),
    nextTaskNumber(boardId) {
      const row = db
        .update(boardBoards)
        .set({ nextNumber: sql`${boardBoards.nextNumber} + 1` })
        .where(eq(boardBoards.id, boardId))
        .returning({ next: boardBoards.nextNumber })
        .get()
      return must(row, 'board').next - 1
    },
    listBoards: () => db.select().from(boardBoards).orderBy(asc(boardBoards.id)).all(),
    getBoard: (id) => db.select().from(boardBoards).where(eq(boardBoards.id, id)).get(),
    listColumns: (boardId) =>
      db
        .select()
        .from(boardColumns)
        .where(eq(boardColumns.boardId, boardId))
        .orderBy(asc(boardColumns.sortOrder), asc(boardColumns.id))
        .all(),
    getColumn: (id) => db.select().from(boardColumns).where(eq(boardColumns.id, id)).get(),
    insertColumn: (c) => db.insert(boardColumns).values(c).returning().get(),
    updateColumn: (id, patch) =>
      must(db.update(boardColumns).set(patch).where(eq(boardColumns.id, id)).returning().get(), 'column'),
    deleteColumn: (id) => void db.delete(boardColumns).where(eq(boardColumns.id, id)).run(),
    listLabels: (boardId) =>
      db.select().from(boardLabels).where(eq(boardLabels.boardId, boardId)).orderBy(asc(boardLabels.id)).all(),
    getLabel: (id) => db.select().from(boardLabels).where(eq(boardLabels.id, id)).get(),
    insertLabel: (l) => db.insert(boardLabels).values(l).returning().get(),
    updateLabel: (id, patch) =>
      must(db.update(boardLabels).set(patch).where(eq(boardLabels.id, id)).returning().get(), 'label'),
    deleteLabel: (id) => void db.delete(boardLabels).where(eq(boardLabels.id, id)).run(),
    listTasks: (q = {}) =>
      db
        .select({ task: boardTasks })
        .from(boardTasks)
        .innerJoin(boardColumns, eq(boardColumns.id, boardTasks.columnId))
        .where(tasksWhere(q))
        .orderBy(asc(boardColumns.sortOrder), asc(boardColumns.id), asc(boardTasks.sortOrder), asc(boardTasks.id))
        .all()
        .map((r) => r.task),
    getTask: (id) => db.select().from(boardTasks).where(eq(boardTasks.id, id)).get(),
    getTaskByKey: (boardId, number) =>
      db
        .select()
        .from(boardTasks)
        .where(and(eq(boardTasks.boardId, boardId), eq(boardTasks.number, number)))
        .get(),
    insertTask: (t) => db.insert(boardTasks).values(t).returning().get(),
    updateTask: (id, patch) =>
      must(db.update(boardTasks).set(patch).where(eq(boardTasks.id, id)).returning().get(), 'task'),
    deleteTask(id) {
      db.transaction(() => {
        db.delete(boardTaskSessions).where(eq(boardTaskSessions.taskId, id)).run()
        db.delete(boardTasks).where(eq(boardTasks.id, id)).run()
      })
    },
    columnTaskKeys: (columnId, excludeTaskId) =>
      db
        .select({ id: boardTasks.id, key: boardTasks.sortOrder })
        .from(boardTasks)
        .where(eq(boardTasks.columnId, columnId))
        .all()
        .filter((r) => r.id !== excludeTaskId)
        .map((r) => r.key),
    clearWorktree: (worktreeId) =>
      db
        .update(boardTasks)
        .set({ worktreeId: null })
        .where(eq(boardTasks.worktreeId, worktreeId))
        .returning({ id: boardTasks.id })
        .all()
        .map((r) => r.id),
    listSessionLinks: (taskIds) =>
      taskIds.length === 0
        ? []
        : db
            .select()
            .from(boardTaskSessions)
            .where(inArray(boardTaskSessions.taskId, taskIds))
            .orderBy(asc(boardTaskSessions.linkedAt), asc(boardTaskSessions.agentSessionId))
            .all(),
    listTaskIdsForSession: (sessionId) =>
      db
        .select({ id: boardTaskSessions.taskId })
        .from(boardTaskSessions)
        .where(eq(boardTaskSessions.agentSessionId, sessionId))
        .all()
        .map((r) => r.id),
    insertSessionLink: (taskId, sessionId, linkedAt) =>
      void db
        .insert(boardTaskSessions)
        .values({ taskId, agentSessionId: sessionId, linkedAt })
        .onConflictDoNothing()
        .run(),
    deleteSessionLink: (taskId, sessionId) =>
      void db
        .delete(boardTaskSessions)
        .where(and(eq(boardTaskSessions.taskId, taskId), eq(boardTaskSessions.agentSessionId, sessionId)))
        .run(),
  }
}
