import type { Logger } from '../../common/logger'
import type { DialogsApi, EnvApi, NotificationsApi, ShellApi, WindowApi } from '../../main/platform'
import type { PlatformAdapter } from './platform'
import { resolveCommand } from './resolve-command'

export class UnsupportedUrlError extends Error {}

export const ALLOWED_EXTERNAL_PROTOCOLS = ['http:', 'https:', 'mailto:'] as const
export const DEFAULT_CONFIRM_KEY = 'core:dialogs.confirm'
export const DEFAULT_CANCEL_KEY = 'core:dialogs.cancel'

export interface Translator {
  t(key: string, options?: Record<string, unknown>): string
}
export interface CommandRunner {
  execute(id: string, args?: unknown): Promise<unknown>
}

export interface PlatformApis {
  dialogs: DialogsApi
  shell: ShellApi
  notifications: NotificationsApi
  window: WindowApi
  env: EnvApi
}

function protocolOf(url: string): string {
  try {
    return new URL(url).protocol
  } catch {
    throw new UnsupportedUrlError(`invalid URL "${url}"`)
  }
}

function memoise<T>(fn: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined
  return () => {
    pending ??= fn()
    return pending
  }
}

function createDialogs(adapter: PlatformAdapter, i18n: Translator): DialogsApi {
  const tr = (key: string | undefined) => (key ? i18n.t(key) : undefined)
  return {
    openFolder: (o = {}) => adapter.dialogs.openFolder({ title: tr(o.titleKey), defaultPath: o.defaultPath }),
    openFile: (o = {}) =>
      adapter.dialogs.openFile({
        title: tr(o.titleKey),
        filters: o.filters?.map((f) => ({ name: i18n.t(f.nameKey), extensions: f.extensions })),
        multiple: o.multiple,
      }),
    confirm: (o) =>
      adapter.dialogs.confirm({
        title: i18n.t(o.titleKey, o.params),
        message: i18n.t(o.messageKey, o.params),
        confirmLabel: i18n.t(o.confirmKey ?? DEFAULT_CONFIRM_KEY),
        cancelLabel: i18n.t(o.cancelKey ?? DEFAULT_CANCEL_KEY),
        destructive: o.destructive,
      }),
  }
}

/** Key-based platform APIs shared by `MainContext` and the `core.*` IPC channels (§10.2). */
export function createPlatformApis(
  adapter: PlatformAdapter,
  i18n: Translator,
  commands: CommandRunner,
  log: Logger,
): PlatformApis {
  const getShellEnv = memoise(() => adapter.getShellEnv())
  return {
    dialogs: createDialogs(adapter, i18n),
    shell: {
      async openExternal(url) {
        const protocol = protocolOf(url)
        if (!(ALLOWED_EXTERNAL_PROTOCOLS as readonly string[]).includes(protocol))
          throw new UnsupportedUrlError(`refusing to open ${protocol} URL externally`)
        await adapter.openExternal(url)
      },
    },
    notifications: {
      show(n) {
        const command = n.onClickCommand
        adapter.showNotification({
          title: i18n.t(n.titleKey, n.params),
          body: i18n.t(n.bodyKey, n.params),
          onClick: command
            ? () => void commands.execute(command.id, command.args).catch((e) => log.error('notification click', e))
            : undefined,
        })
      },
    },
    window: { isFocused: () => adapter.window.isFocused(), onFocusChange: (cb) => adapter.window.onFocusChange(cb) },
    env: {
      getShellEnv,
      resolveCommand: async (cmd) => resolveCommand(cmd, { env: await getShellEnv(), platform: adapter.platform }),
    },
  }
}
