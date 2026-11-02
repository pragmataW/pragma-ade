import type { BoardId, BoardSection, ColumnId } from '../contract'

/** Column names match case-insensitively after trimming (All-projects merge and name lookups in main). */
export const columnMergeKey = (name: string): string => name.trim().toLowerCase()

/** One All-projects column: the boards' columns that share a name. */
export interface MergedColumn {
  key: string
  /** First occurrence (section order). */
  name: string
  columnIdByBoard: Record<BoardId, ColumnId>
}

/**
 * Merges the sections' columns by name, keeping each board's relative order: a column already seen raises the
 * insertion point, a new one is inserted right after the last seen column of its board.
 */
export function mergeColumns(sections: readonly BoardSection[]): MergedColumn[] {
  const merged: MergedColumn[] = []
  for (const s of sections) {
    let prev = -1
    for (const c of s.columns) {
      const key = columnMergeKey(c.name)
      const at = merged.findIndex((m) => m.key === key)
      if (at >= 0) {
        ;(merged[at] as MergedColumn).columnIdByBoard[s.board.id] = c.id
        prev = Math.max(prev, at)
        continue
      }
      prev += 1
      merged.splice(prev, 0, { key, name: c.name, columnIdByBoard: { [s.board.id]: c.id } })
    }
  }
  return merged
}
