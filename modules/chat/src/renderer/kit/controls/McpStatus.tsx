import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Button } from '@pragma/ui/components/button'
import { Popover, PopoverContent, PopoverTrigger } from '@pragma/ui/components/popover'
import { Switch } from '@pragma/ui/components/switch'
import { Plug, RefreshCw, RotateCw } from '@pragma/ui/icons'
import { ICON_PX, ICON_STROKE, SIZE_ICON_XS, SIZE_SM, VARIANT_GHOST } from '../../../constants'
import {
  CHAT_TESTIDS,
  CHAT_TONE,
  type ChatMcpServer,
  type ChatSessionApi,
  type ChatSlotProps,
  hasAction,
  type MCP_SERVER_STATUSES,
  MCP_STATUS,
  SESSION_ACTION,
} from '../../../contract'
import { type ChatTone, TONE_DOT } from '../parts/lib/tone'

type McpStatusValue = (typeof MCP_SERVER_STATUSES)[number]
const MCP_TONE: Record<McpStatusValue, ChatTone> = {
  [MCP_STATUS.connected]: CHAT_TONE.ok,
  [MCP_STATUS.pending]: CHAT_TONE.warn,
  [MCP_STATUS.failed]: CHAT_TONE.err,
  [MCP_STATUS['needs-auth']]: CHAT_TONE.warn,
  [MCP_STATUS.disabled]: CHAT_TONE.neutral,
}
const RECONNECTABLE = new Set<McpStatusValue>([MCP_STATUS.failed, MCP_STATUS['needs-auth']])

/** The worst status of the list (failed > needs-auth/pending > connected > disabled). */
export function aggregateMcpTone(servers: readonly ChatMcpServer[]): ChatTone {
  const tones = servers.map((s) => MCP_TONE[s.status])
  if (tones.includes(CHAT_TONE.err)) return CHAT_TONE.err
  if (tones.includes(CHAT_TONE.warn)) return CHAT_TONE.warn
  return tones.includes(CHAT_TONE.ok) ? CHAT_TONE.ok : CHAT_TONE.neutral
}

const Dot = ({ tone }: { tone: ChatTone }) => (
  <span aria-hidden className={cn('size-2 shrink-0 rounded-full', TONE_DOT[tone])} />
)

function ServerRow({ server, session }: { server: ChatMcpServer; session: ChatSessionApi }) {
  const t = useT()
  const { info } = session.transcript
  const enabled = server.status !== MCP_STATUS.disabled
  return (
    <li data-testid={CHAT_TESTIDS.mcpServer(server.name)} className="flex min-w-0 items-start gap-2 px-2 py-1.5">
      <span className="mt-1.5">
        <Dot tone={MCP_TONE[server.status]} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5 text-[12.5px] text-tx">
          <span className="truncate font-mono">{server.name}</span>
          {server.scope ? <span className="text-[11px] text-fa">{server.scope}</span> : null}
        </span>
        <span className="text-[11.5px] text-mu">
          {t(`chat:mcp.status.${server.status}`)}
          {server.toolCount === undefined ? '' : ` · ${t('chat:mcp.tools', { count: server.toolCount })}`}
        </span>
        {server.error ? <span className="break-words text-[11.5px] text-err">{server.error}</span> : null}
      </span>
      {hasAction(info, SESSION_ACTION.reconnectMcp) && RECONNECTABLE.has(server.status) ? (
        <Button
          variant={VARIANT_GHOST}
          size={SIZE_ICON_XS}
          data-testid={CHAT_TESTIDS.mcpReconnect(server.name)}
          aria-label={t('chat:mcp.reconnect', { name: server.name })}
          title={t('chat:mcp.reconnect', { name: server.name })}
          onClick={() => void session.action({ action: SESSION_ACTION.reconnectMcp, name: server.name })}
          className="size-6 text-mu"
        >
          <RotateCw size={ICON_PX} strokeWidth={ICON_STROKE} />
        </Button>
      ) : null}
      {hasAction(info, SESSION_ACTION.toggleMcp) ? (
        <Switch
          data-testid={CHAT_TESTIDS.mcpToggle(server.name)}
          aria-label={t('chat:mcp.toggle', { name: server.name })}
          checked={enabled}
          onCheckedChange={(v) =>
            void session.action({ action: SESSION_ACTION.toggleMcp, name: server.name, enabled: v })
          }
        />
      ) : null}
    </li>
  )
}

/**
 * Header slot: a plug with the worst server status dot; the popover lists servers with toggle / reconnect. Hidden
 * while the session has no MCP servers (no "0" in the header).
 */
export function McpStatus({ session }: ChatSlotProps) {
  const t = useT()
  const servers = session.transcript.mcpServers
  const canRefresh = hasAction(session.transcript.info, SESSION_ACTION.refreshMcp)
  if (servers.length === 0) return null
  const tone = aggregateMcpTone(servers)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={VARIANT_GHOST}
          size={SIZE_SM}
          data-testid={CHAT_TESTIDS.mcpStatus}
          data-tone={tone}
          aria-label={t('chat:mcp.label', { count: servers.length })}
          title={t('chat:mcp.label', { count: servers.length })}
          className="h-6 gap-1.5 px-1.5 text-[11.5px] text-mu"
        >
          <Plug size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden />
          <Dot tone={tone} />
          <span className="tabular-nums">{servers.length}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex h-8 items-center gap-2 border-b border-bd px-2">
          <span className="flex-1 text-[11px] font-semibold tracking-[0.06em] text-mu uppercase">
            {t('chat:mcp.title')}
          </span>
          {canRefresh ? (
            <Button
              variant={VARIANT_GHOST}
              size={SIZE_ICON_XS}
              data-testid={CHAT_TESTIDS.mcpRefresh}
              aria-label={t('chat:mcp.refresh')}
              title={t('chat:mcp.refresh')}
              onClick={() => void session.action({ action: SESSION_ACTION.refreshMcp })}
              className="size-6 text-mu"
            >
              <RefreshCw size={ICON_PX} strokeWidth={ICON_STROKE} />
            </Button>
          ) : null}
        </div>
        <ul className="max-h-80 overflow-y-auto py-1">
          {servers.map((s) => (
            <ServerRow key={s.name} server={s} session={session} />
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
