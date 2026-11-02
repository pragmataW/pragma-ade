import type { CustomItem } from '@pragma/module-chat/contract'
import { useT } from '@pragma/sdk/renderer'
import { GitFork, History } from '@pragma/ui/icons'
import { ICON_PX, ICON_STROKE, NOTICE_I18N, OPENCODE_CHAT_TESTIDS, ROLE } from './constants'
import type { ChatPartProps } from './kit'
import { NOTICE, noticePayloadSchema } from './payloads'

/** `custom:opencode.notice`: a divider line for a rewind (with the restored files) or a fork. */
export function NoticeRow({ item }: ChatPartProps<CustomItem>) {
  const t = useT()
  const notice = noticePayloadSchema.safeParse(item.data)
  if (!notice.success) return null
  const n = notice.data
  const reverted = n.notice === NOTICE.reverted
  const Icon = reverted ? History : GitFork
  return (
    <div
      role={ROLE.status}
      data-testid={OPENCODE_CHAT_TESTIDS.notice}
      data-notice={n.notice}
      className="flex items-center gap-3 py-1 text-[12px] text-mu"
    >
      <span aria-hidden className="h-px flex-1 bg-bd" />
      <span className="flex min-w-0 max-w-[80%] items-center gap-1.5">
        <Icon size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="shrink-0 text-act" />
        <span className="font-medium text-tx">{t(reverted ? NOTICE_I18N.reverted : NOTICE_I18N.forked)}</span>
        <span className="min-w-0 truncate" title={reverted ? n.files.join('\n') : n.from}>
          {reverted
            ? t(NOTICE_I18N.files, { count: n.files.length, files: n.files.join(', ') })
            : t(NOTICE_I18N.forkedFrom, { id: n.from })}
        </span>
      </span>
      <span aria-hidden className="h-px flex-1 bg-bd" />
    </div>
  )
}
