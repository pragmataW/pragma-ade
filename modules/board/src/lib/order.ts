/** The only sort-key comparator: plain code-unit order, identical to SQLite's BINARY collation (never `localeCompare`). */
export function compareSortKeys(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}
