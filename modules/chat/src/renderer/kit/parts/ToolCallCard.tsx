import { useT } from '@pragma/sdk/renderer'
import { ICON_PX, ICON_STROKE, TOOL_TARGET_FIELDS as TARGET_FIELDS } from '../../../constants'
import { CHAT_DATA_ATTRS, CHAT_TESTIDS, type ChatPartProps, EVENT_KIND, type ToolCallItem } from '../../../contract'
import { FileLink } from './FileLink'
import { CollapsibleCard } from './lib/CollapsibleCard'
import { inputField } from './lib/input-field'
import { StatusGlyph } from './lib/StatusGlyph'
import { toolStatusIcon } from './lib/tool-status-visual'
import { TOOL_BODIES } from './ToolBodies'
import { TOOL_ICONS } from './tool-icons'

/** One tool call: icon by kind, name, mono target, status; the body depends on the kind. */
export function ToolCallCard({ item, session }: ChatPartProps<ToolCallItem>) {
  const t = useT()
  const target = TARGET_FIELDS.map((k) => inputField(item.input, k)).find((v) => v !== undefined)
  const Icon = TOOL_ICONS[item.toolKind]
  const Body = TOOL_BODIES[item.toolKind]
  return (
    <CollapsibleCard
      testId={CHAT_TESTIDS.part(EVENT_KIND.toolCall)}
      attrs={{ [CHAT_DATA_ATTRS.status]: item.status }}
      header={
        <span data-testid={CHAT_TESTIDS.tool(item.toolKind)} className="flex min-w-0 flex-1 items-center gap-2">
          <Icon size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="shrink-0 text-mu" />
          <span className="shrink-0 font-semibold text-tx">{item.name}</span>
          {target ? (
            <FileLink raw={target} session={session} className="min-w-0 flex-1 truncate font-mono text-[12px] text-mu">
              {item.title ?? target}
            </FileLink>
          ) : (
            <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-mu">{item.title ?? ''}</span>
          )}
          <span className="shrink-0 rounded-sm border border-bd px-1.5 text-[11px] text-mu">
            {t(`chat:tool.status.${item.status}`)}
          </span>
          <StatusGlyph {...toolStatusIcon(item.status)} />
        </span>
      }
    >
      <Body item={item} />
    </CollapsibleCard>
  )
}
