import { FILTER_CACHE_MAX, FILTER_SCORE as S } from '../../constants'

/**
 * Fuzzy path matching for the changed-files filter. Everything works on grapheme clusters of the NFC form, so an NFD
 * path (macOS: `s` + U+0327) matches an NFC query (`ş`), and a highlight never splits a combining mark, a surrogate
 * pair or a ZWJ emoji. Case folding is Turkish-aware: `I`, `ı`, `İ` and `i` are one letter.
 */

/** `[start, end)` in UTF-16 code units of the raw (displayed) string. */
export type Range = readonly [start: number, end: number]

export interface PathMatch {
  score: number
  /** Some term matched only with diacritics ignored (`ç` → `c`): ranked below every exact match. */
  loose: boolean
  /** Matched characters, merged, ascending. */
  ranges: Range[]
}

export interface QueryTerm {
  exact: string[]
  loose: string[]
}
/** Space-separated terms, all of which must match; empty = no filter. */
export type ParsedQuery = QueryTerm[]

export interface PreparedPath {
  /** Code-unit offset of each grapheme in the raw string, then the raw length. */
  offsets: number[]
  exact: string[]
  loose: string[]
  /** Positional bonus of each grapheme (word start, basename). */
  bonus: number[]
}

const SEGMENTER = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
const NFC = 'NFC'
const NFD = 'NFD'
const ANY_I = /[İIı]/gu
const PLAIN_I = 'i'
const MARKS = /\p{M}/gu
const LOWER = /\p{Ll}/u
const UPPER = /\p{Lu}/u
const WHITESPACE = /\s+/u
const PATH_SEPARATOR = '/'
const WORD_SEPARATORS = new Set([PATH_SEPARATOR, '-', '_', '.', ' '])
const NONE = Number.NEGATIVE_INFINITY

const graphemesOf = (text: string): string[] => Array.from(SEGMENTER.segment(text), (s) => s.segment)

/** Case fold of one grapheme: NFC, every Turkish I to `i`, then the root locale's lower case. */
export const foldExact = (grapheme: string): string => grapheme.normalize(NFC).replace(ANY_I, PLAIN_I).toLowerCase()

/** `foldExact` without diacritics (`ç` → `c`, `ö` → `o`); a grapheme that is only marks keeps them. */
export function foldLoose(grapheme: string): string {
  const exact = foldExact(grapheme)
  return exact.normalize(NFD).replace(MARKS, '').normalize(NFC) || exact
}

export function parseQuery(text: string): ParsedQuery {
  return text
    .normalize(NFC)
    .trim()
    .split(WHITESPACE)
    .filter((term) => term !== '')
    .map((term) => {
      const graphemes = graphemesOf(term)
      return { exact: graphemes.map(foldExact), loose: graphemes.map(foldLoose) }
    })
}

function isWordStart(prev: string | undefined, current: string): boolean {
  if (prev === undefined || WORD_SEPARATORS.has(prev)) return true
  return LOWER.test(prev) && UPPER.test(current)
}

function positionBonus(graphemes: readonly string[]): number[] {
  const baseStart = graphemes.lastIndexOf(PATH_SEPARATOR) + 1
  return graphemes.map((g, i) => {
    const word = isWordStart(graphemes[i - 1], g) ? S.boundary : 0
    const base = i >= baseStart ? S.basename : 0
    return word + base + (i === baseStart ? S.basenameStart : 0)
  })
}

function offsetsOf(graphemes: readonly string[]): number[] {
  const offsets = [0]
  for (const g of graphemes) offsets.push((offsets.at(-1) ?? 0) + g.length)
  return offsets
}

const cache = new Map<string, PreparedPath>()

/** Segments and folds a path once (memoized: the list re-filters on every keystroke). */
export function preparePath(raw: string): PreparedPath {
  const hit = cache.get(raw)
  if (hit) return hit
  if (cache.size >= FILTER_CACHE_MAX) cache.clear()
  const graphemes = graphemesOf(raw)
  const prepared = {
    offsets: offsetsOf(graphemes),
    exact: graphemes.map(foldExact),
    loose: graphemes.map(foldLoose),
    bonus: positionBonus(graphemes),
  }
  cache.set(raw, prepared)
  return prepared
}

function isSubsequence(query: readonly string[], target: readonly string[]): boolean {
  let i = 0
  for (const g of target) if (g === query[i]) i++
  return i === query.length
}

interface Row {
  score: number[]
  /** Where the previous query grapheme sits for the best score at each position (-1: none). */
  from: Int32Array
}

/**
 * One DP row: the best score with query grapheme `ch` at each target position, either right after the previous
 * grapheme (consecutive bonus) or after a gap from the best earlier position.
 */
function scoreRow(ch: string, prev: Row | null, target: readonly string[], bonus: readonly number[]): Row {
  const n = target.length
  const row: Row = { score: new Array<number>(n).fill(NONE), from: new Int32Array(n).fill(-1) }
  let best = NONE
  let bestAt = -1
  // The best predecessor before a gap sits at most at j - 2: the position the previous iteration saw as j - 1.
  let pending = -1
  for (let j = 0; j < n; j++) {
    const earlier = prev?.score[pending] ?? NONE
    if (earlier > best) [best, bestAt] = [earlier, pending]
    pending = j - 1
    if (target[j] !== ch) continue
    const own = S.match + (bonus[j] ?? 0)
    if (prev === null) {
      row.score[j] = own
      continue
    }
    const consecutive = (prev.score[j - 1] ?? NONE) + own + S.consecutive
    const gapped = best + own - S.gap
    row.score[j] = Math.max(consecutive, gapped)
    row.from[j] = consecutive >= gapped ? j - 1 : bestAt
  }
  return row
}

function bestEnd(scores: readonly number[]): number {
  let at = 0
  scores.forEach((s, j) => {
    if (s > (scores[at] ?? NONE)) at = j
  })
  return at
}

interface TermHit {
  score: number
  at: number[]
}

/** The best alignment of one term's graphemes as a subsequence of the target's, or null. */
function alignTerm(query: readonly string[], target: readonly string[], bonus: readonly number[]): TermHit | null {
  if (query.length === 0 || !isSubsequence(query, target)) return null
  const rows: Row[] = []
  for (const ch of query) rows.push(scoreRow(ch, rows.at(-1) ?? null, target, bonus))
  const last = rows.at(-1)?.score ?? []
  const end = bestEnd(last)
  const at = [end]
  for (let i = rows.length - 1; i > 0; i--) at.unshift(rows[i]?.from[at[0] ?? 0] ?? 0)
  return { score: last[end] ?? NONE, at }
}

/** Grapheme indices (ascending, unique) → merged code-unit ranges of the raw string. */
function toRanges(indices: readonly number[], offsets: readonly number[]): Range[] {
  const ranges: [number, number][] = []
  for (const i of indices) {
    const [start, end] = [offsets[i] ?? 0, offsets[i + 1] ?? 0]
    const last = ranges.at(-1)
    if (last && last[1] === start) last[1] = end
    else ranges.push([start, end])
  }
  return ranges
}

/** Every term must match (exactly, else with diacritics ignored); null when one does not. */
export function matchPath(path: PreparedPath, query: ParsedQuery): PathMatch | null {
  let score = 0
  let loose = false
  const hit = new Set<number>()
  for (const term of query) {
    const exact = alignTerm(term.exact, path.exact, path.bonus)
    const found = exact ?? alignTerm(term.loose, path.loose, path.bonus)
    if (found === null) return null
    loose ||= exact === null
    score += found.score
    for (const at of found.at) hit.add(at)
  }
  return {
    score,
    loose,
    ranges: toRanges(
      [...hit].sort((a, b) => a - b),
      path.offsets,
    ),
  }
}

/** Sort order: exact matches before diacritic-insensitive ones, then higher score first. */
export const compareMatches = (a: PathMatch, b: PathMatch): number =>
  Number(a.loose) - Number(b.loose) || b.score - a.score
