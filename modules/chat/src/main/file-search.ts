import { FILE_LIST_CACHE_MS, FILE_RANK, PATH_SEPARATOR } from '../constants'

const isSubsequence = (needle: string, hay: string): boolean => {
  let i = 0
  for (const ch of hay) if (ch === needle[i]) i++
  return i === needle.length
}

/** Rank of `path` for `query` (lower is better): basename prefix > path prefix > subsequence; null = no match. */
export function rankPath(path: string, query: string): number | null {
  const p = path.toLowerCase()
  const q = query.toLowerCase()
  const base = p.slice(p.lastIndexOf(PATH_SEPARATOR) + 1)
  if (base.startsWith(q)) return FILE_RANK.basenamePrefix
  if (p.startsWith(q)) return FILE_RANK.pathPrefix
  return isSubsequence(q, p) ? FILE_RANK.subsequence : null
}

export function rankFiles(files: readonly string[], query: string, limit: number): string[] {
  return files
    .flatMap((path) => {
      const rank = rankPath(path, query)
      return rank === null ? [] : [{ path, rank }]
    })
    .sort((a, b) => a.rank - b.rank || a.path.length - b.path.length || a.path.localeCompare(b.path))
    .slice(0, limit)
    .map((m) => m.path)
}

/** `@file` search over a worktree's tracked and untracked (not ignored) files, cached per worktree. */
export function createFileSearch(deps: { listFiles(path: string): Promise<string[]>; now?: () => number }) {
  const now = deps.now ?? Date.now
  const cache = new Map<string, { at: number; files: Promise<string[]> }>()
  const files = (path: string): Promise<string[]> => {
    const hit = cache.get(path)
    if (hit && now() - hit.at < FILE_LIST_CACHE_MS) return hit.files
    const fresh = deps.listFiles(path).catch((e: unknown) => {
      cache.delete(path)
      throw e
    })
    cache.set(path, { at: now(), files: fresh })
    return fresh
  }
  return {
    async search(path: string, query: string, limit: number): Promise<string[]> {
      return rankFiles(await files(path), query, limit)
    },
  }
}
