import { CoreIpc } from '../../common/core-ipc'
import type { IpcClient } from './ipc-client'

export interface LayoutStore {
  get(key: string): string | undefined
  set(key: string, value: string): void
  /** For `react-resizable-panels` `useDefaultLayout({ storage })`. */
  storage: Pick<Storage, 'getItem' | 'setItem'>
}

/** Pane sizes etc., persisted in settings.json `core.layout` through `core.layout.set`. */
export function createLayoutStore(initial: Record<string, string>, ipc: IpcClient): LayoutStore {
  const values = new Map(Object.entries(initial))
  const set = (key: string, value: string): void => {
    if (values.get(key) === value) return
    values.set(key, value)
    void ipc.invoke(CoreIpc.layoutSet, { key, value })
  }
  const get = (key: string): string | undefined => values.get(key)
  return { get, set, storage: { getItem: (key) => get(key) ?? null, setItem: set } }
}
