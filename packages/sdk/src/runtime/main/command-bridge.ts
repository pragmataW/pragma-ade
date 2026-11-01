import { type CommandInfo, CoreIpc } from '../../common/core-ipc'
import type { Logger } from '../../common/logger'
import { RENDERER_COMMAND_TIMEOUT_MS } from '../../constants'
import type { RemoteCommands } from '../shared/command-registry'
import type { IpcRouter } from './ipc-router'

export class RendererCommandError extends Error {}

export type RendererCommandBridge = RemoteCommands & {
  announce(list: CommandInfo[]): void
  resolve(result: { requestId: string; ok: boolean; value?: unknown; error?: string }): void
  dispose(): void
}

interface Pending {
  resolve(v: unknown): void
  reject(e: Error): void
  timer: ReturnType<typeof setTimeout>
}

/** Lets main run commands registered in the renderer (`runInRenderer` → `rendererResult`). */
export function createRendererCommandBridge(
  router: IpcRouter,
  log: Logger,
  timeoutMs = RENDERER_COMMAND_TIMEOUT_MS,
): RendererCommandBridge {
  let announced: CommandInfo[] = []
  const pending = new Map<string, Pending>()
  let nextId = 0
  return {
    has: (id) => announced.some((c) => c.id === id),
    list: () => announced,
    execute(id, args) {
      nextId += 1
      const requestId = String(nextId)
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(requestId)
          reject(new RendererCommandError(`renderer command ${id} timed out`))
        }, timeoutMs)
        pending.set(requestId, { resolve, reject, timer })
        router.publish(CoreIpc.commandsRunInRenderer, { requestId, id, args })
      })
    },
    announce(list) {
      announced = list
    },
    resolve(result) {
      const entry = pending.get(result.requestId)
      if (!entry) return log.warn(`late renderer command result ${result.requestId}`)
      pending.delete(result.requestId)
      clearTimeout(entry.timer)
      if (result.ok) entry.resolve(result.value)
      else entry.reject(new RendererCommandError(result.error ?? 'renderer command failed'))
    },
    dispose() {
      for (const entry of pending.values()) clearTimeout(entry.timer)
      pending.clear()
    },
  }
}
