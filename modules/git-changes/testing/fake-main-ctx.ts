import type { EventDef, IpcContract, IpcEventContract, ServiceToken } from '@pragma/sdk'
import type { MainContext } from '@pragma/sdk/main'

type Fn = (...args: never[]) => unknown
const noop = () => undefined
const disposable = (fn: () => void = noop) => ({ dispose: fn })

/**
 * The slice of `MainContext` git-changes uses: an IPC handler map (`invoke` parses input and output like the SDK
 * router), recorded `publish` calls, a wired event bus, a services map, a command map and a fixed settings value.
 */
export function fakeMainCtx<S>(opts: { settings?: S; services?: [ServiceToken<unknown>, unknown][] } = {}) {
  const handlers = new Map<string, (input: unknown) => unknown>()
  const listeners = new Map<string, Set<(p: unknown) => void>>()
  const services = new Map((opts.services ?? []).map(([t, impl]) => [t.id, impl]))
  const commands = new Map<string, Fn>()
  const published: { channel: string; payload: unknown }[] = []
  const quiet = { debug: noop, info: noop, warn: noop, error: noop }
  const ctx = {
    ipc: {
      handle<I, O>(c: IpcContract<I, O>, h: (input: I, meta: { senderId: number }) => O | Promise<O>) {
        handlers.set(c.channel, (input) => h(c.input.parse(input), { senderId: 0 }))
        return disposable(() => handlers.delete(c.channel))
      },
      publish<P>(c: IpcEventContract<P>, payload: P) {
        published.push({ channel: c.channel, payload: c.payload.parse(payload) })
      },
    },
    events: {
      emit<P>(def: EventDef<P>, payload: P) {
        for (const cb of listeners.get(def.name) ?? []) cb(payload)
      },
      on<P>(def: EventDef<P>, cb: (payload: P) => void) {
        const set = listeners.get(def.name) ?? new Set()
        listeners.set(def.name, set.add(cb as (p: unknown) => void))
        return disposable(() => set.delete(cb as (p: unknown) => void))
      },
    },
    services: {
      get<T>(t: ServiceToken<T>): T {
        if (!services.has(t.id)) throw new Error(`service ${t.id} is not provided`)
        return services.get(t.id) as T
      },
      tryGet: <T>(t: ServiceToken<T>) => services.get(t.id) as T | undefined,
      provide<T>(t: ServiceToken<T>, impl: T) {
        services.set(t.id, impl)
        return disposable()
      },
    },
    commands: {
      has: (id: string) => commands.has(id),
      register(id: string | { id: string }, handler: Fn) {
        commands.set(typeof id === 'string' ? id : id.id, handler)
        return disposable()
      },
      execute: async (id: string, args?: unknown) =>
        (commands.get(id) as ((a: unknown) => unknown) | undefined)?.(args),
    },
    settings: { get: () => opts.settings as S },
    log: { ...quiet, child: () => quiet },
  }
  return {
    ctx: ctx as unknown as MainContext<S>,
    published,
    publishedOn: <P>(c: IpcEventContract<P>) => published.filter((p) => p.channel === c.channel).map((p) => p.payload),
    async invoke<I, O>(c: IpcContract<I, O>, input: unknown): Promise<O> {
      const handler = handlers.get(c.channel)
      if (!handler) throw new Error(`no handler for ${c.channel}`)
      return c.output.parse(await handler(input))
    },
    emit: ctx.events.emit,
  }
}
export type FakeMainCtx<S> = ReturnType<typeof fakeMainCtx<S>>
