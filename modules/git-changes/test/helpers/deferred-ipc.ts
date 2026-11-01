import type { IpcContract, IpcEventContract } from '@pragma/sdk'
import { type GitChangesRendererContext, setRendererCtx } from '../../src/renderer/lib/sdk'

export interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
}
export function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

/**
 * A renderer IPC whose every invoke is parked until the test answers it (`pending`), and whose events the test fires
 * with `fire`. Installed as the git-changes renderer context (only `ipc` is usable).
 */
export function installDeferredIpc() {
  const pending: { channel: string; input: unknown; answer: Deferred<unknown> }[] = []
  const events = new Map<string, Set<(p: unknown) => void>>()
  const ipc = {
    invoke<I, O>(c: IpcContract<I, O>, input: I): Promise<O> {
      const answer = deferred<unknown>()
      pending.push({ channel: c.channel, input, answer })
      return answer.promise as Promise<O>
    },
    subscribe<P>(c: IpcEventContract<P>, cb: (p: P) => void) {
      const set = events.get(c.channel) ?? new Set()
      events.set(c.channel, set.add(cb as (p: unknown) => void))
      return { dispose: () => void set.delete(cb as (p: unknown) => void) }
    },
  }
  setRendererCtx({ ipc } as unknown as GitChangesRendererContext)
  return {
    pending,
    on: (channel: string) => pending.filter((p) => p.channel === channel),
    fire<P>(c: IpcEventContract<P>, payload: P) {
      for (const cb of events.get(c.channel) ?? []) cb(payload)
    },
  }
}
