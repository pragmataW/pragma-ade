import { useEffect, useState } from 'react'
import { highlightToHtml } from '../lib/highlight'
import { cn } from '../lib/utils'

/** Highlighted code via the shared Shiki instance; a plain `<pre>` until highlighting finishes. */
export function CodeBlock({ code, lang, className }: { code: string; lang: string; className?: string }) {
  const [html, setHtml] = useState<string | null>(null)
  useEffect(() => {
    let latest = true
    void highlightToHtml(code, lang).then((out) => {
      if (latest) setHtml(out)
    })
    return () => {
      latest = false
    }
  }, [code, lang])
  if (html === null)
    return (
      <pre className={cn('font-mono', className)}>
        <code>{code}</code>
      </pre>
    )
  // Shiki escapes the code; the HTML contains only its own spans.
  // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted Shiki output (escaped)
  return <div className={cn('pragma-code', className)} dangerouslySetInnerHTML={{ __html: html }} />
}
