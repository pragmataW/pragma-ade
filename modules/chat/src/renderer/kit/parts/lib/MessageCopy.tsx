import { useT } from '@pragma/sdk/renderer'
import { CopyButton } from '@pragma/ui/components/copy-button'
import { CHAT_TESTIDS } from '../../../../contract'

/** Copies a message's raw text (Markdown as written); the feedback timing is `@pragma/ui`'s. */
export function MessageCopy({ text, className }: { text: string; className?: string }) {
  const t = useT()
  return (
    <span data-testid={CHAT_TESTIDS.copyMessage} className={className}>
      <CopyButton
        text={text}
        label={t('chat:copy.message')}
        copiedLabel={t('chat:copy.copied')}
        className="size-6 text-mu"
      />
    </span>
  )
}
