import { useT } from '@pragma/sdk/renderer'
import { CHAT_TESTIDS, type ChatPartProps, EVENT_KIND, type FileEditItem } from '../../../contract'
import { HunkDiff } from './HunkDiff'

/** Inline diff card of an edit/write: mono path, change badge, the hunks (expanded by default). */
export function FileEditDiff({ item }: ChatPartProps<FileEditItem>) {
  const t = useT()
  return (
    <div
      data-testid={CHAT_TESTIDS.part(EVENT_KIND.fileEdit)}
      className="overflow-hidden rounded-lg border border-bd bg-el"
    >
      <div className="flex h-8 items-center gap-2 border-b border-bd bg-pn px-2.5">
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-tx" title={item.path}>
          {item.path}
        </span>
        <span className="shrink-0 rounded-sm border border-bd px-1.5 text-[11px] text-mu">
          {t(`chat:diff.change.${item.change}`)}
        </span>
      </div>
      <HunkDiff path={item.path} hunks={item.hunks} />
    </div>
  )
}
