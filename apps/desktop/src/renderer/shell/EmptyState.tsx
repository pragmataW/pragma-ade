import { useT } from '@pragma/sdk/renderer'

/** Centered placeholder text (i18n key) with a test id. */
export function EmptyState({ textKey, testId }: { textKey: string; testId: string }) {
  const t = useT()
  return (
    <div data-testid={testId} className="flex h-full items-center justify-center text-[var(--mu)]">
      {t(textKey)}
    </div>
  )
}
