/** Narrowing readers for untyped SDK frame fields. */
export type Obj = Record<string, unknown>
export const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {})
export const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
export const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
export const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.map(obj) : [])
