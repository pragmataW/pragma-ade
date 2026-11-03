import { cn } from '@pragma/ui'
import { Markdown, type MarkdownComponents } from '@pragma/ui/components/markdown'
import { Check } from 'lucide-react'
import { type ComponentProps, memo, useCallback, useMemo } from 'react'
import { CHECK_STROKE, CODE_SEGMENT } from '../../../../constants'
import { splitFences } from '../../../lib/markdown-segments'
import { holdPartialTable } from '../../../lib/stream-stable'
import { useLatest } from '../../../lib/use-latest'
import { CodeSegment } from './CodeSegment'
import { MarkdownTable, MarkdownTableRow } from './MarkdownTable'

const CHECKBOX = 'checkbox'

/** GFM task-list box (`- [ ]` / `- [x]`), drawn instead of the native disabled checkbox. */
function TaskBox({ type, checked, node: _node }: ComponentProps<'input'> & { node?: unknown }) {
  if (type !== CHECKBOX) return null
  return (
    <span
      aria-hidden
      data-checked={checked || undefined}
      className="mr-2 inline-flex size-3.5 shrink-0 translate-y-[2.5px] items-center justify-center rounded-[4px] border border-bd2 bg-el align-top text-acfg data-[checked]:border-ac data-[checked]:bg-ac"
    >
      {checked && <Check className="size-2.5" strokeWidth={CHECK_STROKE} />}
    </span>
  )
}

const COMPONENTS: MarkdownComponents = { table: MarkdownTable, tr: MarkdownTableRow, input: TaskBox }

/** Prose rhythm (headings, lists, quotes, rules, inline code) on top of Tailwind's reset. */
export const PROSE_CLASS = cn(
  'min-w-0 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-2',
  '[&_h1]:mt-5 [&_h1]:mb-2 [&_h1]:font-semibold [&_h1]:text-[17px] [&_h1]:leading-snug [&_h1]:tracking-[-0.01em]',
  '[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:border-bd [&_h2]:border-b [&_h2]:pb-1 [&_h2]:font-semibold [&_h2]:text-[15px] [&_h2]:leading-snug',
  '[&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:font-semibold [&_h3]:text-[13.5px]',
  '[&_:is(h4,h5,h6)]:mt-3.5 [&_:is(h4,h5,h6)]:mb-1 [&_:is(h4,h5,h6)]:font-semibold [&_:is(h4,h5,h6)]:text-[11px] [&_:is(h4,h5,h6)]:text-mu [&_:is(h4,h5,h6)]:uppercase [&_:is(h4,h5,h6)]:tracking-[0.06em]',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_li]:pl-0.5',
  '[&_li::marker]:text-fa [&_ol>li::marker]:text-[12px] [&_ol>li::marker]:tabular-nums [&_:is(ul,ol)_:is(ul,ol)]:my-1',
  '[&_ul.contains-task-list]:list-none [&_ul.contains-task-list]:pl-0.5 [&_li.task-list-item]:pl-0',
  '[&_blockquote]:my-3 [&_blockquote]:rounded-r-md [&_blockquote]:border-ac/70 [&_blockquote]:border-l-2 [&_blockquote]:bg-acs/40 [&_blockquote]:py-1.5 [&_blockquote]:pr-3 [&_blockquote]:pl-3 [&_blockquote]:text-mu [&_blockquote_p]:my-1',
  '[&_hr]:my-5 [&_hr]:border-0 [&_hr]:border-bd [&_hr]:border-t',
  '[&_:not(pre)>code]:rounded-[4px] [&_:not(pre)>code]:border [&_:not(pre)>code]:border-bd [&_:not(pre)>code]:bg-hv/70 [&_:not(pre)>code]:px-[5px] [&_:not(pre)>code]:py-px [&_:not(pre)>code]:text-[0.88em] [&_:not(pre)>code]:break-words',
  '[&_a]:text-act [&_a]:underline [&_a]:decoration-act/35 [&_a]:underline-offset-2 [&_a]:transition-colors [&_a:hover]:decoration-act',
  '[&_strong]:font-semibold [&_strong]:text-tx [&_del]:text-mu [&_img]:max-w-full [&_img]:rounded-md',
)

const ProseSegment = memo(function ProseSegment({
  text,
  onLinkClick,
}: {
  text: string
  onLinkClick: (href: string) => void
}) {
  return <Markdown source={text} onLinkClick={onLinkClick} components={COMPONENTS} className={PROSE_CLASS} />
})

/**
 * Assistant Markdown with rich blocks: tables, Mermaid diagrams (once the fence closes), ASCII diagrams and
 * highlighted code. Finished segments are memoized, so a long streaming message only re-renders its tail.
 */
export function RichMarkdown({
  text,
  streaming = false,
  onLinkClick,
}: {
  text: string
  streaming?: boolean
  onLinkClick(href: string): void
}) {
  const segments = useMemo(() => splitFences(streaming ? holdPartialTable(text) : text), [text, streaming])
  const latest = useLatest(onLinkClick)
  const onLink = useCallback((href: string) => latest.current(href), [latest])
  return (
    <>
      {segments.map((s, i) =>
        s.kind === CODE_SEGMENT ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional parts of one message
          <CodeSegment key={i} code={s.code} lang={s.lang} closed={s.closed} />
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional parts of one message
          <ProseSegment key={i} text={s.text} onLinkClick={onLink} />
        ),
      )}
    </>
  )
}
