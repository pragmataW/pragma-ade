import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import {
  Children,
  type ComponentProps,
  cloneElement,
  createContext,
  isValidElement,
  type JSX,
  type ReactElement,
  useContext,
  useRef,
} from 'react'
import { TABLE_MAX_HEIGHT_PX } from '../../../../constants'
import { CHAT_TESTIDS } from '../../../../contract'
import { CopyChip } from './CopyChip'
import { type TableData, tableData, toCsv, toMarkdown } from './table-data'
import { useScrollEdges } from './use-scroll-edges'

type WithNode<T extends keyof JSX.IntrinsicElements> = ComponentProps<T> & { node?: unknown }

const NUMERIC_ATTR = 'data-numeric'

/** Per column: right-align it (numbers, and the Markdown sets no alignment). */
const RightColumns = createContext<readonly boolean[]>([])

const TABLE_CLASS = cn(
  'w-full border-separate border-spacing-0 text-[12.5px] leading-[1.45] tabular-nums',
  '[&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:whitespace-nowrap [&_th]:bg-pn [&_th]:px-3 [&_th]:py-[7px] [&_th]:text-left [&_th]:font-semibold [&_th]:text-[12px] [&_th]:text-tx',
  '[&_th]:shadow-[inset_0_-1px_0_var(--bd)]',
  '[&_td]:border-bd [&_td]:border-t [&_td]:px-3 [&_td]:py-[6px] [&_td]:align-top [&_td]:text-tx',
  '[&_tbody_tr:first-child_td]:border-t-0',
  '[&_tbody_tr:nth-child(even)]:bg-[color-mix(in_srgb,var(--hv)_42%,transparent)]',
  '[&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-hv',
  '[&_[data-numeric]]:text-right',
)

const FADE = 'pointer-events-none absolute inset-y-0 z-[2] w-6 from-el to-transparent'

function TableCopy({ data }: { data: TableData }) {
  const t = useT()
  return (
    <div className="absolute top-1 right-1 z-[3] flex items-center gap-0.5 rounded-md border border-bd bg-el/95 p-0.5 opacity-0 shadow-sm backdrop-blur-sm transition-opacity focus-within:opacity-100 group-hover/table:opacity-100">
      <CopyChip
        testId={CHAT_TESTIDS.mdTableCopyMarkdown}
        text={() => toMarkdown(data)}
        label={t('chat:markdown.markdown')}
        title={t('chat:markdown.copyMarkdown')}
      />
      <CopyChip
        testId={CHAT_TESTIDS.mdTableCopyCsv}
        text={() => toCsv(data)}
        label={t('chat:markdown.csv')}
        title={t('chat:markdown.copyCsv')}
      />
    </div>
  )
}

/** A GFM table: bordered card, sticky header, zebra rows, numbers right-aligned, edge fades, copy as Markdown/CSV. */
export function MarkdownTable({ node, children, className: _className, ...rest }: WithNode<'table'>) {
  const data = tableData(node)
  const scroller = useRef<HTMLDivElement>(null)
  const { edges, onScroll } = useScrollEdges(scroller)
  const right = data ? data.numeric.map((n, i) => n && data.aligns[i] === null) : []
  return (
    <div
      data-testid={CHAT_TESTIDS.mdTable}
      className="group/table relative my-3 overflow-hidden rounded-lg border border-bd bg-el"
    >
      <div ref={scroller} onScroll={onScroll} style={{ maxHeight: TABLE_MAX_HEIGHT_PX }} className="overflow-auto">
        <table {...rest} className={TABLE_CLASS}>
          <RightColumns.Provider value={right}>{children}</RightColumns.Provider>
        </table>
      </div>
      {edges.start && <span aria-hidden className={cn(FADE, 'left-0 bg-gradient-to-r')} />}
      {edges.end && <span aria-hidden className={cn(FADE, 'right-0 bg-gradient-to-l')} />}
      {data && <TableCopy data={data} />}
    </div>
  )
}

/** A table row whose numeric cells are marked for right alignment (explicit Markdown alignment still wins). */
export function MarkdownTableRow({ node: _node, children, ...rest }: WithNode<'tr'>) {
  const right = useContext(RightColumns)
  let col = 0
  const cells = Children.map(children, (child) => {
    if (!isValidElement(child)) return child
    const i = col++
    return right[i] ? cloneElement(child as ReactElement<Record<string, unknown>>, { [NUMERIC_ATTR]: '' }) : child
  })
  return <tr {...rest}>{cells}</tr>
}
