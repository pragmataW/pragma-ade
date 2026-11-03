import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BUTTON_TYPE, COPIED_FEEDBACK_MS } from '../constants/ui'
import { copyText } from '../lib/clipboard'
import { Button } from './button'

/** Icon button that copies `text`; labels arrive already translated so @pragma/ui stays i18n-free. */
export function CopyButton({
  text,
  label,
  copiedLabel,
  className,
}: {
  text: string
  label: string
  copiedLabel: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [copied])
  const current = copied ? copiedLabel : label
  return (
    <Button
      type={BUTTON_TYPE}
      variant="ghost"
      size="icon"
      className={className}
      aria-label={current}
      title={current}
      data-copied={copied || undefined}
      onClick={async () => setCopied(await copyText(text))}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  )
}
