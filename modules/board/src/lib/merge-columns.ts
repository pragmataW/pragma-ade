/** Column names match case-insensitively after trimming (All-projects merge and name lookups in main). */
export const columnMergeKey = (name: string): string => name.trim().toLowerCase()
