import type { ChangedFile } from '../../contract'
import { entryKey, filesUnder, TREE_NODE_KINDS, type TreeNode } from '../tree/build-tree'
import { compareMatches, matchPath, type ParsedQuery, type PathMatch, preparePath, type Range } from './match'

/** A change list through the filter: the entries shown (best match first) and each one's match by `entryKey`. */
export interface FileFilter {
  /** A query is typed. */
  active: boolean
  visible: readonly ChangedFile[]
  matches: ReadonlyMap<string, PathMatch>
  /** Entries before filtering. */
  total: number
}

const NO_MATCHES: ReadonlyMap<string, PathMatch> = new Map()
const NO_RANGES: Range[] = []
const [DIR_KIND] = TREE_NODE_KINDS

interface Hit {
  file: ChangedFile
  match: PathMatch
  index: number
}

const byRank = (a: Hit, b: Hit): number =>
  compareMatches(a.match, b.match) || a.file.path.length - b.file.path.length || a.index - b.index

export function filterFiles(files: readonly ChangedFile[], query: ParsedQuery): FileFilter {
  if (query.length === 0) return { active: false, visible: files, matches: NO_MATCHES, total: files.length }
  const hits = files.flatMap((file, index): Hit[] => {
    const match = matchPath(preparePath(file.path), query)
    return match ? [{ file, match, index }] : []
  })
  hits.sort(byRank)
  return {
    active: true,
    visible: hits.map((h) => h.file),
    matches: new Map(hits.map((h) => [entryKey(h.file), h.match])),
    total: files.length,
  }
}

/** `ranges` cut to `[start, start + length)` and moved to start at 0, merged. */
export function sliceRanges(ranges: readonly Range[], start: number, length: number): Range[] {
  const end = start + length
  const out: [number, number][] = []
  for (const [a, b] of [...ranges].sort(([x], [y]) => x - y)) {
    const [from, to] = [Math.max(a, start) - start, Math.min(b, end) - start]
    if (from >= to) continue
    const last = out.at(-1)
    if (last && from <= last[1]) last[1] = Math.max(last[1], to)
    else out.push([from, to])
  }
  return out
}

/**
 * What a tree row highlights in its label: a file its own match, a directory what its files matched inside the
 * directory's path. A label is always the end of the row's path (`name` is a suffix of `path`).
 */
export function nodeRanges(node: TreeNode, matches: ReadonlyMap<string, PathMatch>): Range[] {
  if (matches.size === 0) return NO_RANGES
  const labelStart = node.path.length - node.name.length
  if (node.file) return sliceRanges(matches.get(entryKey(node.file))?.ranges ?? NO_RANGES, labelStart, node.name.length)
  if (node.kind !== DIR_KIND) return NO_RANGES
  const inside = filesUnder(node).flatMap((f) => matches.get(entryKey(f))?.ranges ?? NO_RANGES)
  return sliceRanges(inside, labelStart, node.name.length)
}
