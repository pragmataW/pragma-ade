import { CoreIpc } from '../../common/core-ipc'
import { type Disposable, toDisposable } from '../../common/disposable'
import type { RendererSettings } from '../../renderer/types'
import type { IpcClient } from './ipc-client'

export interface SettingsClient {
  all(): Record<string, unknown>
  forSection<S>(id: string): RendererSettings<S>
  dispose(): void
}

/** A cache of settings.json kept in sync with `core.settings.changed`; writes go through main. */
export function createSettingsClient(initial: Record<string, unknown>, ipc: IpcClient): SettingsClient {
  const cache: Record<string, unknown> = { ...initial }
  const listeners = new Map<string, Set<(v: unknown) => void>>()
  const apply = (section: string, value: unknown): void => {
    cache[section] = value
    for (const cb of [...(listeners.get(section) ?? [])]) cb(value)
  }
  const sub = ipc.subscribe(CoreIpc.settingsChanged, ({ section, value }) => apply(section, value))
  const forSection = <S>(id: string): RendererSettings<S> => ({
    get: () => cache[id] as S,
    async set(value) {
      const next = (await ipc.invoke(CoreIpc.settingsSet, { section: id, value })) as S
      apply(id, next)
      return next
    },
    async update(patch) {
      const next = (await ipc.invoke(CoreIpc.settingsUpdate, { section: id, patch })) as S
      apply(id, next)
      return next
    },
    subscribe(cb): Disposable {
      const set = listeners.get(id) ?? new Set()
      listeners.set(id, set)
      const fn = cb as (v: unknown) => void
      set.add(fn)
      return toDisposable(() => set.delete(fn))
    },
    read: <U>(moduleId: string) => cache[moduleId] as U,
  })
  return { all: () => ({ ...cache }), forSection, dispose: () => sub.dispose() }
}
