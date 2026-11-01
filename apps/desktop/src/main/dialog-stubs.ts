import type { DialogStubs } from '@pragma/sdk'
import type { PlatformAdapter } from '@pragma/sdk/runtime/main'

type Dialogs = PlatformAdapter['dialogs']
type StubKey = keyof DialogStubs

const NO_STUB = Symbol('no-stub')
const STUB_KEYS = { openFolder: 'openFolder', openFile: 'openFile', confirm: 'confirm' } as const satisfies Record<
  StubKey,
  StubKey
>

/** Test-mode dialogs: a stubbed method answers from the stub (arrays are consumed, scalars reused), else the real one. */
export function createStubbedDialogs(real: Dialogs, initial: DialogStubs = {}) {
  let stubs: DialogStubs = { ...initial }
  const next = (key: StubKey): unknown => {
    const stub = stubs[key]
    if (stub === undefined) return NO_STUB
    if (!Array.isArray(stub)) return stub
    return stub.length > 0 ? stub.shift() : NO_STUB
  }
  const answer = <T>(key: StubKey, fallback: () => Promise<T>): Promise<T> => {
    const value = next(key)
    return value === NO_STUB ? fallback() : Promise.resolve(value as T)
  }
  const dialogs: Dialogs = {
    openFolder: (o) => answer(STUB_KEYS.openFolder, () => real.openFolder(o)),
    openFile: (o) => answer(STUB_KEYS.openFile, () => real.openFile(o)),
    confirm: (o) => answer(STUB_KEYS.confirm, () => real.confirm(o)),
  }
  return {
    dialogs,
    setStubs(s: DialogStubs) {
      stubs = structuredClone(s)
    },
  }
}
