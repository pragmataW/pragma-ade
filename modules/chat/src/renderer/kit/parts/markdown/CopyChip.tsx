import { COPIED_FEEDBACK_MS } from '@pragma/ui/constants/ui'
import { copyText } from '@pragma/ui/lib/clipboard'
import { Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { BUTTON_TYPE } from '../../../../constants'

/** A small text button that copies `text` (e.g. "Markdown", "CSV") and flashes a check. */
export function CopyChip({
  text,
  label,
  title,
  testId,
}: {
  text: () => string
  label: string
  title: string
  testId?: string
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const copy = async () => {
    if (!(await copyText(text()))) return
    clearTimeout(timer.current)
    setCopied(true)
    timer.current = setTimeout(setCopied, COPIED_FEEDBACK_MS, false)
  }
  const Glyph = copied ? Check : Copy
  return (
    <button
      type={BUTTON_TYPE}
      data-testid={testId}
      data-copied={copied || undefined}
      title={title}
      aria-label={title}
      onClick={copy}
      className="inline-flex h-6 items-center gap-1 rounded-[5px] px-1.5 font-medium text-[11px] text-mu transition-colors hover:bg-hv hover:text-tx focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ac/60 data-[copied]:text-ok"
    >
      <Glyph aria-hidden className="size-3" />
      {label}
    </button>
  )
}
