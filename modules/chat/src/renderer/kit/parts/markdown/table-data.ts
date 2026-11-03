import {
  CELL_BREAK_RE,
  CSV_NEEDS_QUOTES_RE,
  CSV_QUOTE_RE,
  CSV_SEPARATOR,
  MD_CELL_SEPARATOR,
  MD_PIPE_RE,
  NEWLINE,
  NUMERIC_CELL_RE,
} from '../../../../constants'

/** The subset of a hast node a table needs (react-markdown passes the element as `node`). */
export interface HastLike {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastLike[]
}

export const CELL_ALIGNS = ['left', 'center', 'right'] as const
export type CellAlign = (typeof CELL_ALIGNS)[number]

export interface TableData {
  header: string[]
  rows: string[][]
  /** Alignment written in the Markdown delimiter row (`:--`, `:-:`, `--:`), per column. */
  aligns: (CellAlign | null)[]
  /** Columns whose body cells are all numbers (right-aligned when the Markdown sets no alignment). */
  numeric: boolean[]
}

const HEAD = 'thead'
const ROW = 'tr'
const TEXT = 'text'
const ALIGN = 'align'

const isHast = (v: unknown): v is HastLike =>
  typeof v === 'object' && v !== null && typeof (v as { type?: unknown }).type === 'string'

const textOf = (node: HastLike): string =>
  node.type === TEXT ? (node.value ?? '') : (node.children ?? []).map(textOf).join('')

const elements = (node: HastLike, tag?: string): HastLike[] =>
  (node.children ?? []).filter((c) => c.tagName !== undefined && (tag === undefined || c.tagName === tag))

const alignOf = (cell: HastLike): CellAlign | null => {
  const a = cell.properties?.[ALIGN]
  return CELL_ALIGNS.find((x) => x === a) ?? null
}

const cellsOf = (row: HastLike): HastLike[] => elements(row)

const isNumericColumn = (rows: string[][], col: number): boolean => {
  const values = rows.map((r) => (r[col] ?? '').trim()).filter((v) => v !== '')
  return values.length > 0 && values.every((v) => NUMERIC_CELL_RE.test(v))
}

/** Header, body, alignment and numeric columns of a GFM table element. */
export function tableData(node: unknown): TableData | null {
  if (!isHast(node)) return null
  const sections = elements(node)
  const headRow = sections.find((s) => s.tagName === HEAD)?.children?.find((r) => r.tagName === ROW)
  if (!headRow) return null
  const headCells = cellsOf(headRow)
  const rows = sections
    .filter((s) => s.tagName !== HEAD)
    .flatMap((s) => elements(s, ROW))
    .map((r) => cellsOf(r).map((c) => textOf(c).trim()))
  const header = headCells.map((c) => textOf(c).trim())
  return {
    header,
    rows,
    aligns: headCells.map(alignOf),
    numeric: header.map((_, i) => isNumericColumn(rows, i)),
  }
}

const mdCell = (v: string): string => v.replace(MD_PIPE_RE, '\\|').replace(CELL_BREAK_RE, ' ')
const mdRow = (cells: string[]): string => `| ${cells.map(mdCell).join(MD_CELL_SEPARATOR)} |`
const DELIMITER: Record<CellAlign | 'none', string> = { none: '---', left: ':---', center: ':---:', right: '---:' }

/** The table as GFM Markdown (alignment kept). */
export function toMarkdown(t: TableData): string {
  const delimiter = mdRow(t.header.map((_, i) => DELIMITER[t.aligns[i] ?? 'none']))
  return [mdRow(t.header), delimiter, ...t.rows.map(mdRow)].join(NEWLINE)
}

const csvCell = (v: string): string => (CSV_NEEDS_QUOTES_RE.test(v) ? `"${v.replace(CSV_QUOTE_RE, '""')}"` : v)

/** The table as RFC 4180 CSV. */
export function toCsv(t: TableData): string {
  return [t.header, ...t.rows].map((r) => r.map(csvCell).join(CSV_SEPARATOR)).join(NEWLINE)
}
