import { defineIpc, defineIpcEvent, z } from '@pragma/sdk'
import { SPLIT_ACTIONS, WorktreeTerminalLayoutSchema } from './layout'
import { PtyExitSchema, PtyInfoSchema, PtySizeSchema, PtySnapshotSchema } from './pty'

/** Every IPC channel of the module (`terminal.<action>`). */
export const TerminalChannels = {
  ptyAttach: 'terminal.ptyAttach',
  ptyWrite: 'terminal.ptyWrite',
  ptyResize: 'terminal.ptyResize',
  openLink: 'terminal.openLink',
  layoutGet: 'terminal.layoutGet',
  tabCreate: 'terminal.tabCreate',
  tabClose: 'terminal.tabClose',
  tabRename: 'terminal.tabRename',
  tabActivate: 'terminal.tabActivate',
  tabSplit: 'terminal.tabSplit',
  paneClose: 'terminal.paneClose',
  ptyData: 'terminal.ptyData',
  ptyExit: 'terminal.ptyExit',
  layoutChanged: 'terminal.layoutChanged',
  serviceRestarted: 'terminal.serviceRestarted',
} as const

const none = z.void()
const ptyRef = z.object({ ptyId: z.string() })
const worktreeRef = z.object({ worktreeId: z.string() })
const tabRef = worktreeRef.extend({ tabId: z.string() })
const layout = WorktreeTerminalLayoutSchema

export const PtyAttachResultSchema = z.discriminatedUnion('found', [
  z.object({ found: z.literal(false) }),
  /** `exit` is set once the pty ended (including a daemon restart, which drops its buffer). */
  z.object({
    found: z.literal(true),
    info: PtyInfoSchema,
    snapshot: PtySnapshotSchema,
    exit: PtyExitSchema.nullable(),
  }),
])
export type PtyAttachResult = z.infer<typeof PtyAttachResultSchema>

export const PtyDataPayloadSchema = z.object({ ptyId: z.string(), seq: z.number().int(), data: z.string() })
export type PtyDataPayload = z.infer<typeof PtyDataPayloadSchema>

export const terminalIpc = {
  ptyAttach: defineIpc({ channel: TerminalChannels.ptyAttach, input: ptyRef, output: PtyAttachResultSchema }),
  ptyWrite: defineIpc({ channel: TerminalChannels.ptyWrite, input: ptyRef.extend({ data: z.string() }), output: none }),
  ptyResize: defineIpc({
    channel: TerminalChannels.ptyResize,
    input: ptyRef.extend(PtySizeSchema.shape),
    output: none,
  }),
  openLink: defineIpc({ channel: TerminalChannels.openLink, input: z.object({ url: z.string() }), output: none }),
  layoutGet: defineIpc({ channel: TerminalChannels.layoutGet, input: worktreeRef, output: layout }),
  tabCreate: defineIpc({ channel: TerminalChannels.tabCreate, input: worktreeRef, output: layout }),
  tabClose: defineIpc({ channel: TerminalChannels.tabClose, input: tabRef, output: layout }),
  /** A title that is empty after trimming resets to the default label. */
  tabRename: defineIpc({
    channel: TerminalChannels.tabRename,
    input: tabRef.extend({ title: z.string() }),
    output: layout,
  }),
  tabActivate: defineIpc({ channel: TerminalChannels.tabActivate, input: tabRef, output: layout }),
  tabSplit: defineIpc({
    channel: TerminalChannels.tabSplit,
    input: tabRef.extend({ direction: z.enum(SPLIT_ACTIONS) }),
    output: layout,
  }),
  paneClose: defineIpc({
    channel: TerminalChannels.paneClose,
    input: tabRef.extend({ paneId: z.string() }),
    output: layout,
  }),
} as const

export const terminalIpcEvents = {
  ptyData: defineIpcEvent({ channel: TerminalChannels.ptyData, payload: PtyDataPayloadSchema }),
  ptyExit: defineIpcEvent({ channel: TerminalChannels.ptyExit, payload: PtyExitSchema }),
  layoutChanged: defineIpcEvent({ channel: TerminalChannels.layoutChanged, payload: layout }),
  serviceRestarted: defineIpcEvent({ channel: TerminalChannels.serviceRestarted, payload: z.object({}) }),
} as const
