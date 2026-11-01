import type { BoardSnapshot } from '../contract'

/** Tasks not in their board's last column (the sidebar count). */
export function openCount(snapshot: Pick<BoardSnapshot, 'sections' | 'tasks'>): number {
  const lastColumn = new Map(snapshot.sections.map((s) => [s.board.id, s.columns.at(-1)?.id]))
  return snapshot.tasks.filter((t) => lastColumn.get(t.boardId) !== t.columnId).length
}
