import { contextBridge, type IpcRendererEvent, ipcRenderer } from 'electron'
import { EVENT_CHANNEL, INVOKE_CHANNEL } from '../constants'

interface EventMessage {
  channel: string
  payload: unknown
}

/** The whole preload surface: `window.pragma = { invoke, subscribe }` (§1.8, §4.3). No module-specific code. */
contextBridge.exposeInMainWorld('pragma', {
  invoke: (channel: string, input: unknown) => ipcRenderer.invoke(INVOKE_CHANNEL, { channel, input }),
  subscribe(channel: string, cb: (payload: unknown) => void): () => void {
    const listener = (_event: IpcRendererEvent, message: EventMessage) => {
      if (message.channel === channel) cb(message.payload)
    }
    ipcRenderer.on(EVENT_CHANNEL, listener)
    return () => ipcRenderer.off(EVENT_CHANNEL, listener)
  },
})
