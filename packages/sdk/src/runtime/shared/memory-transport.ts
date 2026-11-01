import type { IpcResponse } from '../../common/ipc'

export interface IpcMeta {
  senderId: number
}

export interface IpcRequest {
  channel: string
  input: unknown
}

export type InvokeHandler = (req: IpcRequest, meta: IpcMeta) => Promise<IpcResponse>

/** Main-side end of the IPC pipe (Electron `ipcMain` in the app, in-memory in tests). */
export interface IpcTransport {
  onInvoke(handler: InvokeHandler): void
  broadcast(channel: string, payload: unknown): void
}

/** Renderer-side end; the preload exposes exactly this as `window.pragma`. */
export interface PragmaBridge {
  invoke(channel: string, input: unknown): Promise<IpcResponse>
  subscribe(channel: string, cb: (payload: unknown) => void): () => void
}

export const MEMORY_SENDER_ID = 1

/** In-process transport + bridge pair; values are structured-cloned like real IPC. */
export function createMemoryTransport(): { transport: IpcTransport; bridge: PragmaBridge } {
  let handler: InvokeHandler | undefined
  const subscribers = new Map<string, Set<(payload: unknown) => void>>()
  const transport: IpcTransport = {
    onInvoke(h) {
      handler = h
    },
    broadcast(channel, payload) {
      for (const cb of [...(subscribers.get(channel) ?? [])]) cb(structuredClone(payload))
    },
  }
  const bridge: PragmaBridge = {
    async invoke(channel, input) {
      if (!handler) throw new Error('memory transport has no invoke handler')
      return structuredClone(await handler({ channel, input: structuredClone(input) }, { senderId: MEMORY_SENDER_ID }))
    },
    subscribe(channel, cb) {
      const set = subscribers.get(channel) ?? new Set()
      subscribers.set(channel, set)
      set.add(cb)
      return () => set.delete(cb)
    },
  }
  return { transport, bridge }
}
