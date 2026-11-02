import type { BoardSection, LinkedSessionDto, TaskDto } from '../../src/contract'
import type { BoardRepo } from '../../src/main/repo'
import type { BoardRow, TaskInsert, TaskRow } from '../../src/main/schema'

export const NOW = 1_700_000_000_000

/** A board row for project `p1` (override any field). */
export function seedBoard(repo: BoardRepo, o: Partial<{ projectId: string; name: string; keyPrefix: string }> = {}) {
  return repo.insertBoard({ projectId: 'p1', name: 'pragma-ade', keyPrefix: 'PRA', createdAt: NOW, ...o })
}

/** A column in `board` with sort key `sortOrder` (default `a0`). */
export const seedColumn = (repo: BoardRepo, board: BoardRow, name = 'Todo', sortOrder = 'a0') =>
  repo.insertColumn({ boardId: board.id, name, sortOrder })

/** A task row in `columnId` of `board` with the next number. */
export function seedTask(repo: BoardRepo, board: BoardRow, o: Partial<TaskInsert> & { columnId: number }): TaskRow {
  return repo.insertTask({
    boardId: board.id,
    number: repo.nextTaskNumber(board.id),
    title: 'Task',
    descriptionMd: '',
    priority: 'none',
    labelsJson: '[]',
    worktreeId: null,
    sortOrder: 'a0',
    createdAt: NOW,
    updatedAt: NOW,
    ...o,
  })
}

/** A complete task DTO (board 1, project p1, column 1, no labels/worktree/sessions). */
export function aTask(over: Partial<TaskDto> = {}): TaskDto {
  const id = over.id ?? 1
  return {
    id,
    key: `PRA-${id}`,
    number: id,
    boardId: 1,
    projectId: 'p1',
    columnId: 1,
    title: `Task ${id}`,
    descriptionMd: '',
    priority: 'none',
    labelIds: [],
    worktreeId: null,
    sortKey: 'a0',
    sessions: [],
    sessionIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  }
}

/** A linked-session DTO for profile `profileId`. */
export function aLinkedSession(sessionId: string, over: Partial<LinkedSessionDto> = {}): LinkedSessionDto {
  return {
    sessionId,
    worktreeId: 'w1',
    title: null,
    status: null,
    turnCompleted: false,
    profileId: 'fake',
    profileName: 'Fake',
    profileDisplayNameKey: null,
    providerId: 'custom',
    startedAt: 0,
    ended: false,
    ...over,
  }
}

/** A board section: `columns` are names (ids `boardId * 10 + index`), `labels` are names (same id scheme + 100). */
export function aSection(
  boardId: number,
  projectName: string,
  columns: readonly string[] = ['Backlog', 'Todo', 'In Progress', 'Review', 'Done'],
  labels: readonly string[] = [],
): BoardSection {
  const ids = (i: number) => boardId * 10 + i
  return {
    board: {
      id: boardId,
      projectId: `p${boardId}`,
      name: projectName,
      keyPrefix: projectName.slice(0, 3).toUpperCase(),
    },
    projectName,
    columns: columns.map((name, i) => ({ id: ids(i), boardId, name, sortKey: `a${i}` })),
    labels: labels.map((name, i) => ({ id: ids(i) + 100, boardId, name, color: 'gray' })),
  }
}
