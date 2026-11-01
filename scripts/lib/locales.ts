import { isPlainObject } from './objects.ts'

export interface LocaleFile {
  file: string
  json: object
}

type Tree = Record<string, unknown>

interface MergeState {
  owners: Map<string, string>
  file: string
  problems: string[]
}

const canDescend = (value: unknown, existing: unknown): value is Tree =>
  isPlainObject(value) && (existing === undefined || isPlainObject(existing))

function mergeKey(target: Tree, key: string, value: unknown, state: MergeState, path: string): void {
  const existing = target[key]
  if (canDescend(value, existing)) {
    target[key] = existing ?? {}
    if (!state.owners.has(path)) state.owners.set(path, state.file)
    mergeInto(target[key] as Tree, value, state, path)
    return
  }
  if (existing !== undefined) {
    state.problems.push(`locale key ${path} defined in ${state.owners.get(path)} and ${state.file}`)
    return
  }
  target[key] = value
  state.owners.set(path, state.file)
}

function mergeInto(target: Tree, source: Tree, state: MergeState, prefix: string): void {
  for (const [key, value] of Object.entries(source))
    mergeKey(target, key, value, state, prefix ? `${prefix}.${key}` : key)
}

/** Deep-merges one language's files; a leaf defined twice is a problem (§10.1.5). */
export function mergeLocaleFilesChecked(files: readonly LocaleFile[]): { merged: Tree; problems: string[] } {
  const merged: Tree = {}
  const owners = new Map<string, string>()
  const problems: string[] = []
  for (const f of files) mergeInto(merged, f.json as Tree, { owners, file: f.file, problems }, '')
  return { merged, problems }
}

export class LocaleConflictError extends Error {}

export function mergeLocaleFiles(files: readonly LocaleFile[]): object {
  const { merged, problems } = mergeLocaleFilesChecked(files)
  if (problems.length > 0) throw new LocaleConflictError(problems.join('\n'))
  return merged
}
