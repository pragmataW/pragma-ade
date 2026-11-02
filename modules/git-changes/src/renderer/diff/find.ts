/** The code text of a rendered diff line (gutters and line numbers live elsewhere). */
const CODE_LINE_SELECTOR = '[data-content] [data-line]'
const TEXT_NODE = 3
/** Turkish dotted/dotless i in both cases: one letter for searching (`id` finds `ID`, `istanbul` finds `İSTANBUL`). */
const I_FAMILY = new Set(['i', 'I', 'İ', 'ı'])
const I_KEY = 'i'

/**
 * Case-folds one UTF-16 unit to exactly one unit, so offsets in the folded text are offsets in the original (a
 * plain `toLowerCase` turns `İ` into two units and shifts every match after it). ç/Ç, ğ/Ğ, ş/Ş, ö/Ö, ü/Ü fold normally.
 */
function foldUnit(unit: string): string {
  if (I_FAMILY.has(unit)) return I_KEY
  const lower = unit.toLowerCase()
  return lower.length === 1 ? lower : unit
}
const fold = (text: string): string =>
  Array.from({ length: text.length }, (_, i) => foldUnit(text[i] as string)).join('')
/** A typed `ç` is composed; a file may hold it decomposed (c + U+0327): the query is looked up in both forms. */
const FORMS = ['NFC', 'NFD'] as const

const textNodesOf = (el: Element): Text[] => {
  const out: Text[] = []
  const walk = (node: Node): void => {
    for (const child of node.childNodes) {
      if (child.nodeType === TEXT_NODE) out.push(child as Text)
      else walk(child)
    }
  }
  walk(el)
  return out
}

/** A Range over `[start, end)` of the concatenated text of `nodes`. */
function rangeOver(nodes: Text[], start: number, end: number): Range {
  const range = document.createRange()
  let offset = 0
  for (const node of nodes) {
    const next = offset + node.data.length
    if (start >= offset && start <= next) range.setStart(node, start - offset)
    if (end >= offset && end <= next) {
      range.setEnd(node, end - offset)
      break
    }
    offset = next
  }
  return range
}

/** `[start, end)` of every occurrence of any needle in `hay` (needles that differ only in Unicode form). */
function spans(hay: string, needles: readonly string[]): [number, number][] {
  const seen = new Map<number, number>()
  for (const needle of needles)
    for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + needle.length))
      if (!seen.has(at)) seen.set(at, at + needle.length)
  return [...seen].sort((a, b) => a[0] - b[0])
}

/** Every case-insensitive, literal occurrence of `query` in the code lines under `root`, line by line. */
export function findInDiff(root: ParentNode, query: string): Range[] {
  if (query === '') return []
  const needles = [...new Set(FORMS.map((f) => fold(query.normalize(f))))]
  const out: Range[] = []
  for (const line of root.querySelectorAll(CODE_LINE_SELECTOR)) {
    const nodes = textNodesOf(line)
    const hay = fold(nodes.map((n) => n.data).join(''))
    for (const [start, end] of spans(hay, needles)) out.push(rangeOver(nodes, start, end))
  }
  return out
}

/** Reading order on screen: top to bottom, then left to right (split view has two columns). */
export function byPosition(ranges: Range[]): Range[] {
  const at = ranges.map((r) => ({ r, box: r.getBoundingClientRect() }))
  at.sort((a, b) => a.box.top - b.box.top || a.box.left - b.box.left)
  return at.map((x) => x.r)
}

/** `index` moved by `step` (±1), wrapping around `count` matches. */
export const wrapIndex = (index: number, step: number, count: number): number =>
  count === 0 ? 0 : (index + step + count) % count
