import type { Disposable } from '../../common/disposable'
import type { AppearanceMode } from '../../common/theme'

/** The only Electron seam: the shell supplies the real adapter, tests a fake one. */
export interface PlatformAdapter {
  dialogs: {
    openFolder(o: { title?: string; defaultPath?: string }): Promise<string | null>
    openFile(o: {
      title?: string
      filters?: { name: string; extensions: string[] }[]
      multiple?: boolean
    }): Promise<string[] | null>
    confirm(o: {
      title: string
      message: string
      confirmLabel: string
      cancelLabel: string
      destructive?: boolean
    }): Promise<boolean>
  }
  openExternal(url: string): Promise<void>
  showNotification(n: { title: string; body: string; onClick?: () => void }): void
  theme: { setSource(mode: AppearanceMode): void; shouldUseDark(): boolean; onUpdated(cb: () => void): Disposable }
  window: { isFocused(): boolean; onFocusChange(cb: (focused: boolean) => void): Disposable }
  getShellEnv(): Promise<Record<string, string>>
  isPackaged: boolean
  resourcesPath: string
  platform: string
}
