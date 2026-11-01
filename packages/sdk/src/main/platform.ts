import type { ConfirmInput, NotificationInput, OpenFileInput, OpenFolderInput } from '../common/core-ipc'
import type { Disposable } from '../common/disposable'

/** `ctx.dialogs` — key-based; the SDK translates (§10.2). */
export interface DialogsApi {
  openFolder(o?: OpenFolderInput): Promise<string | null>
  openFile(o?: OpenFileInput): Promise<string[] | null>
  confirm(o: ConfirmInput): Promise<boolean>
}

/** `ctx.shell` — only `http:`, `https:` and `mailto:` URLs. */
export interface ShellApi {
  openExternal(url: string): Promise<void>
}

/** `ctx.notifications`. */
export interface NotificationsApi {
  show(n: NotificationInput): void
}

/** `ctx.window` (main only). */
export interface WindowApi {
  isFocused(): boolean
  onFocusChange(cb: (focused: boolean) => void): Disposable
}

/** `ctx.env` — the single owner of login-shell env resolution (§10.2). */
export interface EnvApi {
  getShellEnv(): Promise<Record<string, string>>
  resolveCommand(cmd: string): Promise<string | null>
}

export type { ConfirmInput, NotificationInput, OpenFileInput, OpenFolderInput }
