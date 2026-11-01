import { type CommandInfo, CoreIpc } from '../../common/core-ipc'
import type { Disposable } from '../../common/disposable'
import type { Logger } from '../../common/logger'
import { type CommandRegistry, createCommandRegistry, type RemoteCommands } from '../shared/command-registry'
import type { IpcClient } from './ipc-client'

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/** Renderer command registry: main commands are remote; local ones are announced so main can run them. */
export function createRendererCommands(
  ipc: IpcClient,
  initial: CommandInfo[],
  log: Logger,
): { commands: CommandRegistry; dispose(): void } {
  let mainCommands = initial
  const remote: RemoteCommands = {
    has: (id) => mainCommands.some((c) => c.id === id),
    list: () => mainCommands,
    execute: (id, args) => ipc.invoke(CoreIpc.commandsExecute, { id, args }),
  }
  const commands = createCommandRegistry({ remote, log })
  const announce = (): void =>
    void ipc.invoke(CoreIpc.commandsAnnounce, commands.listLocal()).catch((e) => log.error('announce', e))
  const subs: Disposable[] = [
    ipc.subscribe(CoreIpc.commandsChanged, (list) => {
      mainCommands = list
    }),
    ipc.subscribe(CoreIpc.commandsRunInRenderer, ({ requestId, id, args }) => {
      commands.execute(id, args).then(
        (value) => ipc.invoke(CoreIpc.commandsRendererResult, { requestId, ok: true, value }),
        (error: unknown) =>
          ipc.invoke(CoreIpc.commandsRendererResult, { requestId, ok: false, error: messageOf(error) }),
      )
    }),
    commands.onChange(announce),
  ]
  return {
    commands,
    dispose: () => {
      for (const s of subs) s.dispose()
    },
  }
}
