import type { ComponentProps, MouseEvent } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import { LANGUAGE_CLASS, PLAIN_LANG } from '../constants/ui'
import { cn } from '../lib/utils'
import { CodeBlock } from './code-block'

const LINK_TARGET = '_blank'
const LINK_REL = 'noreferrer'
const TRAILING_NEWLINE = /\n$/

function components(onLinkClick?: (href: string) => void): Components {
  return {
    pre: ({ children }) => <>{children}</>,
    a: ({ href, children, node: _node, ...rest }: ComponentProps<'a'> & { node?: unknown }) => (
      <a
        {...rest}
        href={href}
        target={LINK_TARGET}
        rel={LINK_REL}
        onClick={(e: MouseEvent) => {
          if (!onLinkClick || !href) return
          e.preventDefault()
          onLinkClick(href)
        }}
      >
        {children}
      </a>
    ),
    code: ({ className, children, node: _node, ...rest }: ComponentProps<'code'> & { node?: unknown }) => {
      const text = String(children)
      const lang = LANGUAGE_CLASS.exec(className ?? '')?.groups?.lang
      const isBlock = lang !== undefined || TRAILING_NEWLINE.test(text)
      if (!isBlock)
        return (
          <code className={className} {...rest}>
            {children}
          </code>
        )
      return <CodeBlock code={text.replace(TRAILING_NEWLINE, '')} lang={lang ?? PLAIN_LANG} />
    },
  }
}

/** Safe Markdown (GFM, sanitized, no raw HTML); fenced code goes through the shared highlighter. */
export function Markdown({
  source,
  className,
  onLinkClick,
}: {
  source: string
  className?: string
  onLinkClick?: (href: string) => void
}) {
  return (
    <div className={cn('pragma-markdown', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={components(onLinkClick)}>
        {source}
      </ReactMarkdown>
    </div>
  )
}
