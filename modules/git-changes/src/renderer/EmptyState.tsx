import { GitChangesTestIds as T } from '../contract'

/** A centred one-line message in the panel body. */
export function EmptyState({ text, kind }: { text: string; kind: string }) {
  return (
    <div
      data-testid={T.empty}
      data-kind={kind}
      className="flex flex-1 items-center justify-center p-6 text-muted-foreground text-sm"
    >
      {text}
    </div>
  )
}
