import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { GitCompare } from '@pragma/ui/icons'
import { ICON_PX, ICON_STROKE, SIZE_ICON_XS, VARIANT_GHOST } from '../../../constants'
import { CHAT_TESTIDS, type ChatPartProps, EVENT_KIND, type FileEditItem } from '../../../contract'
import { FileLink } from './FileLink'
import { HunkDiff } from './HunkDiff'
import { useFileLinks } from './lib/use-file-links'

/** Inline diff card of an edit/write: mono path, change badge, the hunks (expanded by default). */
export function FileEditDiff({ item, session }: ChatPartProps<FileEditItem>) {
  const t = useT()
  const { reveal } = useFileLinks(session)
  return (
    <div
      data-testid={CHAT_TESTIDS.part(EVENT_KIND.fileEdit)}
      className="overflow-hidden rounded-lg border border-bd bg-el"
    >
      <div className="flex h-8 items-center gap-2 border-b border-bd bg-pn px-2.5">
        <FileLink raw={item.path} session={session} className="min-w-0 flex-1 truncate font-mono text-[12px] text-tx" />
        <span className="shrink-0 rounded-sm border border-bd px-1.5 text-[11px] text-mu">
          {t(`chat:diff.change.${item.change}`)}
        </span>
        {reveal ? (
          <Button
            variant={VARIANT_GHOST}
            size={SIZE_ICON_XS}
            data-testid={CHAT_TESTIDS.revealInGit}
            aria-label={t('chat:fileLink.revealInGit')}
            title={t('chat:fileLink.revealInGit')}
            onClick={() => reveal(item.path)}
            className="size-6 text-mu"
          >
            <GitCompare size={ICON_PX} strokeWidth={ICON_STROKE} />
          </Button>
        ) : null}
      </div>
      <HunkDiff path={item.path} hunks={item.hunks} />
    </div>
  )
}
