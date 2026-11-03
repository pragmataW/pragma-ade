import { useT } from '@pragma/sdk/renderer'
import { CodeBlock } from '@pragma/ui/components/code-block'
import { PLAIN_LANG } from '@pragma/ui/constants/ui'
import { memo } from 'react'
import { ASCII_LANGS, BOX_DRAWING_RE, CODE_KIND, MERMAID_LANG } from '../../../../constants'
import { CODE_BODY, CodeFrame, CopyCodeAction } from './CodeFrame'
import { MermaidBlock } from './MermaidBlock'

export type CodeKind = (typeof CODE_KIND)[keyof typeof CODE_KIND]

const ASCII = new Set<string>(ASCII_LANGS)

/** How a fence renders: Mermaid diagram, exact-layout plain text (ASCII art, box diagrams), or highlighted code. */
export function codeKind(lang: string): CodeKind {
  const l = lang.toLowerCase()
  if (l === MERMAID_LANG) return CODE_KIND.mermaid
  return ASCII.has(l) ? CODE_KIND.ascii : CODE_KIND.code
}

/**
 * ASCII/box diagrams: one font that has the box-drawing glyphs (the bundled JetBrains Mono subset lacks them, and a
 * fallback glyph of another width breaks the boxes), no ligatures, no tracking, a line height where │ and ┼ meet.
 */
const ASCII_BODY =
  'overflow-x-auto [&_pre]:m-0 [&_pre]:w-max [&_pre]:min-w-full [&_pre]:px-3.5 [&_pre]:py-3 [&_pre]:whitespace-pre [&_pre]:text-[12px] [&_pre]:leading-[1.2] [&_pre]:tracking-normal [&_pre]:[font-family:ui-monospace,"SF_Mono",Menlo,"Cascadia_Mono",Consolas,"DejaVu_Sans_Mono",monospace] [&_pre]:[font-variant-ligatures:none] [&_pre]:[font-kerning:none]'

function PlainPre({ code }: { code: string }) {
  return (
    <pre>
      <code>{code}</code>
    </pre>
  )
}

function AsciiBlock({ code }: { code: string }) {
  const t = useT()
  const label = BOX_DRAWING_RE.test(code) ? t('chat:markdown.diagram') : t('chat:markdown.text')
  return (
    <CodeFrame variant={CODE_KIND.ascii} label={label} actions={<CopyCodeAction code={code} />}>
      <div className={ASCII_BODY}>
        <PlainPre code={code} />
      </div>
    </CodeFrame>
  )
}

/** Highlighted code; while the fence is still open it stays plain text (no Shiki pass per streamed chunk). */
export function HighlightedCode({ code, lang, closed }: { code: string; lang: string; closed: boolean }) {
  return (
    <CodeFrame variant={CODE_KIND.code} label={lang || PLAIN_LANG} actions={<CopyCodeAction code={code} />}>
      <div className={CODE_BODY}>{closed ? <CodeBlock code={code} lang={lang} /> : <PlainPre code={code} />}</div>
    </CodeFrame>
  )
}

/** One fenced block of a message (memoized: finished blocks do not re-render while later text streams). */
export const CodeSegment = memo(function CodeSegment({
  code,
  lang,
  closed,
}: {
  code: string
  lang: string
  closed: boolean
}) {
  const kind = codeKind(lang)
  if (kind === CODE_KIND.ascii) return <AsciiBlock code={code} />
  if (kind === CODE_KIND.mermaid && closed) return <MermaidBlock code={code} />
  return <HighlightedCode code={code} lang={lang} closed={closed} />
})
