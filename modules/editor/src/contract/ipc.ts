import { defineIpc, defineIpcEvent, z } from '@pragma/sdk'
import { EditorLanguageStatusSchema } from './bridge'
import { EDITOR_IPC } from './constants'
import { EditorStatusSchema } from './status'

const none = z.object({})
const worktree = z.object({ worktreeId: z.string() })

export const EditorServerInfoSchema = z.object({
  version: z.string(),
  port: z.number().optional(),
  installDir: z.string(),
  pid: z.number().optional(),
})
export type EditorServerInfo = z.infer<typeof EditorServerInfoSchema>

export const EditorIpc = {
  getStatus: defineIpc({ channel: EDITOR_IPC.getStatus, input: none, output: EditorStatusSchema }),
  /** Starts the install and the server when needed. */
  ensureReady: defineIpc({ channel: EDITOR_IPC.ensureReady, input: none, output: EditorStatusSchema }),
  cancelDownload: defineIpc({ channel: EDITOR_IPC.cancelDownload, input: none, output: none }),
  retry: defineIpc({ channel: EDITOR_IPC.retry, input: none, output: EditorStatusSchema }),
  restartServer: defineIpc({ channel: EDITOR_IPC.restartServer, input: none, output: none }),
  /** Deletes the install dir and downloads again. */
  reinstall: defineIpc({ channel: EDITOR_IPC.reinstall, input: none, output: none }),
  getServerInfo: defineIpc({ channel: EDITOR_IPC.getServerInfo, input: none, output: EditorServerInfoSchema }),
  getLanguageStatus: defineIpc({
    channel: EDITOR_IPC.getLanguageStatus,
    input: worktree,
    output: EditorLanguageStatusSchema.nullable(),
  }),
} as const

export const EditorIpcEvents = {
  statusChanged: defineIpcEvent({ channel: EDITOR_IPC.statusChanged, payload: EditorStatusSchema }),
  revealRequested: defineIpcEvent({ channel: EDITOR_IPC.revealRequested, payload: worktree }),
  languageStatusChanged: defineIpcEvent({
    channel: EDITOR_IPC.languageStatusChanged,
    payload: worktree.extend({ status: EditorLanguageStatusSchema.nullable() }),
  }),
} as const
