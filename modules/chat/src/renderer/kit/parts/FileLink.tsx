import { useT } from '@pragma/sdk/renderer'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { KEY_ENTER } from '../../../constants'
import { CHAT_TESTIDS, type ChatSessionApi } from '../../../contract'
import { useFileLinks } from './lib/use-file-links'

/**
 * A file reference: a link running `editor.openFile` (path, line, column), else plain mono text. A `span` with
 * `role="link"`, so it can sit inside a collapsible card header (itself a button).
 */
export function FileLink({
  raw,
  session,
  children,
  className = 'font-mono',
}: {
  raw: string
  session: Pick<ChatSessionApi, 'worktree'>
  children?: ReactNode
  className?: string
}) {
  const t = useT()
  const links = useFileLinks(session)
  const ref = links.refOf(raw)
  const label = children ?? raw
  if (!ref) return <span className={className}>{label}</span>
  const open = (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation()
    e.preventDefault()
    links.open(ref)
  }
  return (
    // biome-ignore lint/a11y/useSemanticElements: it can sit in a collapsible card header (a button), where neither <a> nor <button> may nest
    <span
      role="link"
      tabIndex={0}
      data-testid={CHAT_TESTIDS.fileLink}
      data-path={ref.path}
      title={t('chat:fileLink.open', { path: ref.path })}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === KEY_ENTER) open(e)
      }}
      className={`${className} cursor-pointer underline-offset-2 hover:text-ac hover:underline`}
    >
      {label}
    </span>
  )
}
