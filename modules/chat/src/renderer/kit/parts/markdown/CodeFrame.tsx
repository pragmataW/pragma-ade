import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { CopyButton } from '@pragma/ui/components/copy-button'
import type { ReactNode } from 'react'
import { CHAT_TESTIDS } from '../../../../contract'

/** Header icon-button size (ui-notes: compact icon buttons). */
export const FRAME_ICON_BUTTON = 'size-6 text-mu hover:text-tx [&_svg]:size-3.5'

/** Scrolls sideways, never wraps; the same metrics before and after highlighting (no jump when Shiki finishes). */
export const CODE_BODY =
  'overflow-x-auto font-mono text-[12px] leading-5 [&_pre]:m-0 [&_pre]:w-max [&_pre]:min-w-full [&_pre]:bg-transparent! [&_pre]:px-3 [&_pre]:py-2.5 [&_pre]:whitespace-pre'

/** Copies the block's exact text (the shared `copyCode` test id wraps the button). */
export function CopyCodeAction({ code, label }: { code: string; label?: string }) {
  const t = useT()
  return (
    <div data-testid={CHAT_TESTIDS.copyCode} className="inline-flex">
      <CopyButton
        text={code}
        label={label ?? t('chat:copy.code')}
        copiedLabel={t('chat:copy.copied')}
        className={FRAME_ICON_BUTTON}
      />
    </div>
  )
}

/** A fenced block's card: a slim header (language label, actions) over the body. */
export function CodeFrame({
  label,
  actions,
  variant,
  testId = CHAT_TESTIDS.codeFrame,
  className,
  children,
}: {
  label: ReactNode
  actions?: ReactNode
  /** `data-variant`: code, ascii, mermaid. */
  variant: string
  testId?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div
      data-testid={testId}
      data-variant={variant}
      className={cn('my-3 min-w-0 overflow-hidden rounded-lg border border-bd bg-el', className)}
    >
      <div className="flex h-7 items-center gap-2 border-bd border-b bg-pn pr-1 pl-3">
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-fa">{label}</span>
        <div className="flex shrink-0 items-center gap-0.5">{actions}</div>
      </div>
      {children}
    </div>
  )
}
