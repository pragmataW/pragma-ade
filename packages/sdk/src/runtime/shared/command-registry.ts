import type { CommandDef, CommandHandler, CommandMeta } from '../../common/commands'
import type { CommandInfo } from '../../common/core-ipc'
import { type Disposable, toDisposable } from '../../common/disposable'
import type { Logger } from '../../common/logger'

export class UnknownCommandError extends Error {}
export class DuplicateCommandError extends Error {}

/** Commands that live on the other side of the IPC boundary. */
export interface RemoteCommands {
  has(id: string): boolean
  execute(id: string, args: unknown): Promise<unknown>
  list(): CommandInfo[]
}

export interface CommandRegistry {
  register<A>(idOrDef: string | CommandDef<A>, handler: CommandHandler<A>, meta?: CommandMeta): Disposable
  execute<R = unknown>(id: string, args?: unknown): Promise<R>
  has(id: string): boolean
  /** Local commands plus the remote side's commands. */
  list(): CommandInfo[]
  /** Local commands only (what this side announces to the other). */
  listLocal(): CommandInfo[]
  onChange(cb: () => void): Disposable
  setRemote(remote: RemoteCommands | undefined): void
}

interface Entry {
  handler: CommandHandler<unknown>
  meta: CommandMeta
}

export function createCommandRegistry(opts: { remote?: RemoteCommands; log?: Logger } = {}): CommandRegistry {
  const local = new Map<string, Entry>()
  const listeners = new Set<() => void>()
  let remote = opts.remote
  const notify = (): void => {
    for (const cb of listeners) cb()
  }

  const register = <A>(idOrDef: string | CommandDef<A>, handler: CommandHandler<A>, meta: CommandMeta = {}) => {
    const id = typeof idOrDef === 'string' ? idOrDef : idOrDef.id
    if (local.has(id)) throw new DuplicateCommandError(`command ${id} is already registered`)
    const run: CommandHandler<unknown> =
      typeof idOrDef === 'string' ? (handler as CommandHandler<unknown>) : (args) => handler(idOrDef.args.parse(args))
    local.set(id, { handler: run, meta })
    notify()
    return toDisposable(() => {
      local.delete(id)
      notify()
    })
  }

  const execute = async <R>(id: string, args?: unknown): Promise<R> => {
    const entry = local.get(id)
    if (entry) return (await entry.handler(args)) as R
    if (remote?.has(id)) return (await remote.execute(id, args)) as R
    opts.log?.warn(`unknown command ${id}`)
    throw new UnknownCommandError(`unknown command ${id}`)
  }

  const listLocal = (): CommandInfo[] => [...local].map(([id, e]) => ({ id, ...e.meta }))
  const list = (): CommandInfo[] => {
    const seen = new Set(local.keys())
    return [...listLocal(), ...(remote?.list() ?? []).filter((c) => !seen.has(c.id))]
  }

  return {
    register,
    execute,
    has: (id) => local.has(id) || (remote?.has(id) ?? false),
    list,
    listLocal,
    onChange(cb) {
      listeners.add(cb)
      return toDisposable(() => listeners.delete(cb))
    },
    setRemote(r) {
      remote = r
      notify()
    },
  }
}
