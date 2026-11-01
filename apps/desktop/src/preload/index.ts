import { contextBridge, type IpcRendererEvent, ipcRenderer } from 'electron'
import { EVENT_CHANNEL, INVOKE_CHANNEL } from '../constants'

interface EventMessage {
  channel: string
  payload: unknown
}

type Subscriber = (payload: unknown) => void

/** One `ipcRenderer` listener fans events out by channel (no MaxListeners warning however many subscribers). */
const subscribers = new Map<string, Set<Subscriber>>()
ipcRenderer.on(EVENT_CHANNEL, (_event: IpcRendererEvent, message: EventMessage) => {
  for (const cb of [...(subscribers.get(message.channel) ?? [])]) cb(message.payload)
})

/** The whole preload surface: `window.pragma = { invoke, subscribe }` (§1.8, §4.3). No module-specific code. */
contextBridge.exposeInMainWorld('pragma', {
  invoke: (channel: string, input: unknown) => ipcRenderer.invoke(INVOKE_CHANNEL, { channel, input }),
  subscribe(channel: string, cb: Subscriber): () => void {
    // A fresh wrapper per call, so subscribing the same callback twice needs two unsubscribes (as before).
    const entry: Subscriber = (payload) => cb(payload)
    const set = subscribers.get(channel) ?? new Set<Subscriber>()
    subscribers.set(channel, set)
    set.add(entry)
    return () => {
      set.delete(entry)
      if (set.size === 0 && subscribers.get(channel) === set) subscribers.delete(channel)
    }
  },
})
