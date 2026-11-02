import type { MainContext } from '@pragma/sdk/main'
import { EditorIpc } from '../contract'
import type { EditorRuntime } from './runtime'

const NONE = {} as const

/** `editor.*` IPC handlers (§4.3). */
export function registerEditorIpc(ctx: MainContext, rt: EditorRuntime): void {
  const background = (): void => {
    void rt.start().catch((error: unknown) => ctx.log.warn('editor start failed', error))
  }
  ctx.ipc.handle(EditorIpc.getStatus, () => rt.server.status())
  ctx.ipc.handle(EditorIpc.ensureReady, () => {
    rt.markActivated()
    background()
    return rt.server.status()
  })
  ctx.ipc.handle(EditorIpc.cancelDownload, () => {
    rt.installer.cancel()
    return NONE
  })
  ctx.ipc.handle(EditorIpc.retry, () => {
    background()
    return rt.server.status()
  })
  ctx.ipc.handle(EditorIpc.restartServer, async () => {
    await rt.server.restart()
    return NONE
  })
  ctx.ipc.handle(EditorIpc.reinstall, async () => {
    await rt.server.stop()
    rt.views.destroyAll()
    void rt.installer
      .reinstall()
      .then(() => rt.start())
      .catch((error: unknown) => ctx.log.warn('editor reinstall failed', error))
    return NONE
  })
  ctx.ipc.handle(EditorIpc.getServerInfo, () => rt.server.info())
  ctx.ipc.handle(EditorIpc.getLanguageStatus, ({ worktreeId }) => rt.languageStatus.get(worktreeId) ?? null)
}
