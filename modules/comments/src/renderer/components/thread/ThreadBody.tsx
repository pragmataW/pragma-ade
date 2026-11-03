import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Markdown } from '@pragma/ui/components/markdown'
import { useState } from 'react'
import { BODY_COLLAPSE_CHARS, BODY_COLLAPSE_LINES, BUTTON_TYPE, NEWLINE } from '../../../constants'
import { COMMENTS_TESTIDS as T } from '../../../contract'
import { runtime } from '../../runtime'

/** Compact prose for review threads: tight paragraphs and lists, framed inline code, code blocks on `bg`. */
const THREAD_PROSE = cn(
  'min-w-0 break-words leading-[1.5] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1.5',
  '[&_:is(h1,h2,h3,h4)]:mt-2.5 [&_:is(h1,h2,h3,h4)]:mb-1 [&_:is(h1,h2,h3,h4)]:font-semibold [&_:is(h1,h2,h3,h4)]:text-[13px]',
  '[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_li::marker]:text-fa',
  '[&_blockquote]:my-1.5 [&_blockquote]:border-bd2 [&_blockquote]:border-l-2 [&_blockquote]:pl-2.5 [&_blockquote]:text-mu',
  '[&_:not(pre)>code]:rounded-[4px] [&_:not(pre)>code]:bg-hv [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-px [&_:not(pre)>code]:text-[0.9em]',
  '[&_pre]:my-1.5 [&_pre]:border [&_pre]:border-bd [&_pre]:!bg-bg [&_pre]:text-[12px] [&_.pragma-code]:my-1.5 [&_.pragma-code_pre]:!px-2.5 [&_.pragma-code_pre]:!py-1.5',
  '[&_a]:text-act [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-semibold [&_strong]:text-tx',
)

const isLong = (body: string): boolean =>
  body.length > BODY_COLLAPSE_CHARS || body.split(NEWLINE).length > BODY_COLLAPSE_LINES

const openLink = (href: string) => {
  runtime()
    .shell.openExternal(href)
    .catch((e: unknown) => console.warn('comments: open link failed', e))
}

/**
 * A thread or reply body as Markdown (GFM, sanitized). A long body starts clamped (fade into the card) behind
 * "Show more"; `preview` (a collapsed resolved thread) shows two muted lines and no toggle.
 */
export function ThreadBody({ body, preview, className }: { body: string; preview?: boolean; className?: string }) {
  const t = useT()
  const long = !preview && isLong(body)
  const [expanded, setExpanded] = useState(false)
  const clamped = long && !expanded
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div
        data-testid={T.threadBody}
        data-clamped={long ? String(clamped) : undefined}
        className={cn(
          'relative min-w-0',
          clamped && 'max-h-[13.5em] overflow-hidden',
          clamped && 'after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-10',
          clamped && 'after:bg-gradient-to-b after:from-transparent after:to-[var(--thread-surface,var(--el))]',
        )}
      >
        <Markdown
          source={body}
          onLinkClick={openLink}
          className={cn(THREAD_PROSE, preview && 'line-clamp-2 text-muted-foreground', className)}
        />
      </div>
      {long ? (
        <button
          type={BUTTON_TYPE}
          data-testid={T.threadBodyToggle}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className="self-start rounded-[4px] text-[11.5px] text-[var(--act)] hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {t(expanded ? 'comments:thread.showLess' : 'comments:thread.showMore')}
        </button>
      ) : null}
    </div>
  )
}
