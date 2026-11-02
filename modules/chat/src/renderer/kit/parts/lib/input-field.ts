/** A string field of a tool call's `input` (unknown shape), else undefined. */
export const inputField = (input: unknown, key: string): string | undefined => {
  const v = input && typeof input === 'object' ? (input as Record<string, unknown>)[key] : undefined
  return typeof v === 'string' ? v : undefined
}
