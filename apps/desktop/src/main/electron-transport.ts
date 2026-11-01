import type { IpcResponse } from '@pragma/sdk'
import type { InvokeHandler, IpcTransport } from '@pragma/sdk/runtime/main'
import { BrowserWindow, ipcMain } from 'electron'
import { EVENT_CHANNEL, INVOKE_CHANNEL } from '../constants'

/** `ipcMain.handle` is registered once per process; windows recreated on macOS reuse it. */
export function createElectronTransport(): IpcTransport {
  let handler: InvokeHandler | undefined
  ipcMain.handle(INVOKE_CHANNEL, (event, req: { channel: string; input: unknown }): Promise<IpcResponse> => {
    if (!handler) throw new Error('IPC transport is not ready')
    return handler({ channel: req.channel, input: req.input }, { senderId: event.sender.id })
  })
  return {
    onInvoke(h) {
      handler = h
    },
    broadcast(channel, payload) {
      for (const win of BrowserWindow.getAllWindows())
        if (!win.isDestroyed()) win.webContents.send(EVENT_CHANNEL, { channel, payload })
    },
  }
}
