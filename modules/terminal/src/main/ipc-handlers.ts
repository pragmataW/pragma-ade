import { combineDisposables, type Disposable, toDisposable } from '@pragma/sdk'
import type { MainIpcApi } from '@pragma/sdk/main'
import { ALLOWED_LINK_PROTOCOLS, UNSUPPORTED_LINK_MESSAGE } from '../constants'
import {
  type PtyAttachResult,
  type PtyDataPayload,
  type PtyExit,
  type PtyService,
  terminalIpc,
  terminalIpcEvents,
} from '../contract'
import type { TerminalLayoutStore } from './layout-store'

/** What the IPC layer needs from the pty service beyond the public `PtyService`. */
export interface PtyFeed extends PtyService {
  attach(ptyId: string): Promise<PtyAttachResult>
  onAnyData(cb: (e: PtyDataPayload) => void): () => void
  onAnyExit(cb: (exit: PtyExit) => void): () => void
}

export interface IpcDeps {
  pty: PtyFeed
  layouts: TerminalLayoutStore
  /** Read at call time, so test hooks can record links instead of opening them. */
  openExternal: () => (url: string) => Promise<void>
}

const ALLOWED_LINKS = new Set<string>(ALLOWED_LINK_PROTOCOLS)

function assertWebLink(url: string): void {
  let protocol: string
  try {
    protocol = new URL(url).protocol
  } catch {
    throw new Error(UNSUPPORTED_LINK_MESSAGE)
  }
  if (!ALLOWED_LINKS.has(protocol)) throw new Error(UNSUPPORTED_LINK_MESSAGE)
}

/** Handles every `terminalIpc` contract and forwards pty data/exits to the renderer. */
export function registerIpcHandlers(ipc: MainIpcApi, deps: IpcDeps): Disposable {
  const { pty, layouts } = deps
  const handlers = [
    ipc.handle(terminalIpc.ptyAttach, ({ ptyId }) => pty.attach(ptyId)),
    ipc.handle(terminalIpc.ptyWrite, ({ ptyId, data }) => pty.write(ptyId, data)),
    ipc.handle(terminalIpc.ptyResize, ({ ptyId, cols, rows }) => pty.resize(ptyId, cols, rows)),
    ipc.handle(terminalIpc.openLink, async ({ url }) => {
      assertWebLink(url)
      await deps.openExternal()(url)
    }),
    ipc.handle(terminalIpc.layoutGet, ({ worktreeId }) => layouts.get(worktreeId)),
    ipc.handle(terminalIpc.tabCreate, ({ worktreeId }) => layouts.createTab(worktreeId)),
    ipc.handle(terminalIpc.tabClose, ({ worktreeId, tabId }) => layouts.closeTab(worktreeId, tabId)),
    ipc.handle(terminalIpc.tabRename, ({ worktreeId, tabId, title }) => layouts.renameTab(worktreeId, tabId, title)),
    ipc.handle(terminalIpc.tabActivate, ({ worktreeId, tabId }) => layouts.activateTab(worktreeId, tabId)),
    ipc.handle(terminalIpc.tabSplit, ({ worktreeId, tabId, direction }) => layouts.split(worktreeId, tabId, direction)),
    ipc.handle(terminalIpc.paneClose, ({ worktreeId, tabId, paneId }) => layouts.closePane(worktreeId, tabId, paneId)),
  ]
  const offData = pty.onAnyData((e) => ipc.publish(terminalIpcEvents.ptyData, e))
  const offExit = pty.onAnyExit((exit) => {
    layouts.handleExit(exit)
    ipc.publish(terminalIpcEvents.ptyExit, exit)
  })
  return combineDisposables([...handlers, toDisposable(offData), toDisposable(offExit)])
}
