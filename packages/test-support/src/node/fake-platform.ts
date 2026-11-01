import type { AppearanceMode, Disposable } from '@pragma/sdk'
import { toDisposable } from '@pragma/sdk'
import type { PlatformAdapter } from '@pragma/sdk/runtime/main'

const SYSTEM_MODE: AppearanceMode = 'system'

export interface FakePlatformCall {
  method: string
  args: unknown[]
}

export interface FakePlatformOptions {
  dark?: boolean
  packaged?: boolean
  resourcesPath?: string
  platform?: string
  shellEnv?: Record<string, string>
  dialogReplies?: Partial<{ openFolder: string | null; openFile: string[] | null; confirm: boolean }>
}

export type FakePlatform = PlatformAdapter & {
  calls: FakePlatformCall[]
  setDark(v: boolean): void
  setFocused(v: boolean): void
  clickNotification(i: number): void
  themeSource(): AppearanceMode
}

/** Records every adapter call and scripts replies; mirrors Electron's themeSource semantics. */
export function createFakePlatform(opts: FakePlatformOptions = {}): FakePlatform {
  const calls: FakePlatformCall[] = []
  const record = <T>(method: string, args: unknown[], reply: T): T => {
    calls.push({ method, args })
    return reply
  }
  const replies = opts.dialogReplies ?? {}
  let systemDark = opts.dark ?? true
  let source: AppearanceMode = SYSTEM_MODE
  let focused = true
  const themeListeners = new Set<() => void>()
  const focusListeners = new Set<(f: boolean) => void>()
  const notifications: { onClick?: () => void }[] = []
  const listen = <T>(set: Set<T>, cb: T): Disposable => {
    set.add(cb)
    return toDisposable(() => set.delete(cb))
  }
  return {
    calls,
    dialogs: {
      openFolder: async (o) => record('dialogs.openFolder', [o], replies.openFolder ?? null),
      openFile: async (o) => record('dialogs.openFile', [o], replies.openFile ?? null),
      confirm: async (o) => record('dialogs.confirm', [o], replies.confirm ?? false),
    },
    openExternal: async (url) => record('openExternal', [url], undefined),
    showNotification(n) {
      record('showNotification', [{ title: n.title, body: n.body }], undefined)
      notifications.push(n)
    },
    theme: {
      setSource(mode) {
        record('theme.setSource', [mode], undefined)
        source = mode
      },
      shouldUseDark: () => (source === SYSTEM_MODE ? systemDark : source === 'dark'),
      onUpdated: (cb) => listen(themeListeners, cb),
    },
    window: {
      isFocused: () => focused,
      onFocusChange: (cb) => listen(focusListeners, cb),
    },
    getShellEnv: async () => record('getShellEnv', [], opts.shellEnv ?? { PATH: '/usr/bin' }),
    isPackaged: opts.packaged ?? false,
    resourcesPath: opts.resourcesPath ?? '/resources',
    platform: opts.platform ?? 'darwin',
    setDark(v) {
      systemDark = v
      for (const cb of themeListeners) cb()
    },
    setFocused(v) {
      focused = v
      for (const cb of focusListeners) cb(v)
    },
    clickNotification: (i) => notifications[i]?.onClick?.(),
    themeSource: () => source,
  }
}
