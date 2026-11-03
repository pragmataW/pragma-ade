import type { CustomItem } from '@pragma/module-chat/contract'
import { useT } from '@pragma/sdk/renderer'
import { Bot, Cpu, GitFork, History, Info, type LucideIcon } from '@pragma/ui/icons'
import { ICON_PX, ICON_STROKE, NOTICE_I18N, OPENCODE_CHAT_TESTIDS, ROLE } from './constants'
import type { ChatPartProps } from './kit'
import { NOTICE, type NoticePayload, noticePayloadSchema } from './payloads'

type T = ReturnType<typeof useT>
interface NoticeView {
  Icon: LucideIcon
  /** The emphasized lead, then the muted detail (with its full text as the tooltip). */
  lead: string
  detail?: string
  title?: string
}

function viewOf(n: NoticePayload, t: T): NoticeView {
  switch (n.notice) {
    case NOTICE.reverted: {
      const files = n.files.join(', ')
      return {
        Icon: History,
        lead: t(NOTICE_I18N.reverted),
        detail: t(NOTICE_I18N.files, { count: n.files.length, files }),
        title: n.files.join('\n'),
      }
    }
    case NOTICE.forked:
      return {
        Icon: GitFork,
        lead: t(NOTICE_I18N.forked),
        detail: t(NOTICE_I18N.forkedFrom, { id: n.from }),
        title: n.from,
      }
    case NOTICE.agent:
      return { Icon: Bot, lead: t(NOTICE_I18N.agent, { agent: n.agent }) }
    case NOTICE.model:
      return { Icon: Cpu, lead: t(NOTICE_I18N.model, { model: n.model }) }
    case NOTICE.system:
      return { Icon: Info, lead: n.text }
    default: {
      const never: never = n
      return never
    }
  }
}

/** `custom:opencode.notice`: a divider line for a rewind (with the restored files), a fork, or a switch. */
export function NoticeRow({ item }: ChatPartProps<CustomItem>) {
  const t = useT()
  const notice = noticePayloadSchema.safeParse(item.data)
  if (!notice.success) return null
  const { Icon, lead, detail, title } = viewOf(notice.data, t)
  return (
    <div
      role={ROLE.status}
      data-testid={OPENCODE_CHAT_TESTIDS.notice}
      data-notice={notice.data.notice}
      className="flex items-center gap-3 py-1 text-[12px] text-mu"
    >
      <span aria-hidden className="h-px flex-1 bg-bd" />
      <span className="flex min-w-0 max-w-[80%] items-center gap-1.5">
        <Icon size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="shrink-0 text-act" />
        <span className="font-medium text-tx">{lead}</span>
        {detail ? (
          <span className="min-w-0 truncate" title={title}>
            {detail}
          </span>
        ) : null}
      </span>
      <span aria-hidden className="h-px flex-1 bg-bd" />
    </div>
  )
}
