import type { VscodeApi } from '../../src/vscodeApi'

/** A recording fake of the `VscodeApi` port; later tasks extend it. */
export interface FakeApi extends VscodeApi {
  logs: string[]
  infos: string[]
  warnings: string[]
}

export function fakeApi(o: { folder?: string; env?: Record<string, string | undefined> } = {}): FakeApi {
  const logs: string[] = []
  const infos: string[] = []
  const warnings: string[] = []
  return {
    env: o.env ?? {},
    workspaceFolderPath: () => o.folder,
    log: (m) => logs.push(m),
    showInfo: (m) => infos.push(m),
    showWarning: (m) => warnings.push(m),
    logs,
    infos,
    warnings,
  }
}
