import { cn } from '@pragma/ui'

/** An inline error message (dialogs and settings cards). */
export function ErrorLine({ text, testId, className }: { text: string | null; testId?: string; className?: string }) {
  if (!text) return null
  return (
    <div data-testid={testId} role="alert" className={cn('text-[12px] text-err', className)}>
      {text}
    </div>
  )
}
