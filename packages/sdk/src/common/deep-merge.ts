export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** Untyped merge: objects are merged recursively, arrays and scalars replaced, `undefined` ignored. */
export function mergeUnknown(base: unknown, patch: unknown): unknown {
  if (patch === undefined) return base
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) out[key] = mergeUnknown(base[key], value)
  return out
}

export const deepMerge = <T>(base: T, patch: DeepPartial<T> | undefined): T => mergeUnknown(base, patch) as T
