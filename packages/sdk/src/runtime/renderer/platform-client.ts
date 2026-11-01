import { CoreIpc } from '../../common/core-ipc'
import type { DialogsApi, NotificationsApi, ShellApi } from '../../main/platform'
import type { IpcClient } from './ipc-client'

export interface RendererPlatform {
  dialogs: DialogsApi
  shell: ShellApi
  notifications: NotificationsApi
  nativeViews: { freeze(viewId: string): Promise<void>; unfreeze(viewId: string): Promise<void> }
}

/** The key-based platform APIs, sent over `core.*` IPC (same shapes as main). */
export function createRendererPlatform(ipc: IpcClient): RendererPlatform {
  return {
    dialogs: {
      openFolder: (o = {}) => ipc.invoke(CoreIpc.dialogsOpenFolder, o),
      openFile: (o = {}) => ipc.invoke(CoreIpc.dialogsOpenFile, o),
      confirm: (o) => ipc.invoke(CoreIpc.dialogsConfirm, o),
    },
    shell: { openExternal: (url) => ipc.invoke(CoreIpc.shellOpenExternal, { url }) },
    notifications: { show: (n) => void ipc.invoke(CoreIpc.notificationsShow, n) },
    nativeViews: {
      freeze: (viewId) => ipc.invoke(CoreIpc.nativeViewsFreeze, { viewId }),
      unfreeze: (viewId) => ipc.invoke(CoreIpc.nativeViewsUnfreeze, { viewId }),
    },
  }
}
