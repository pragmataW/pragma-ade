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
