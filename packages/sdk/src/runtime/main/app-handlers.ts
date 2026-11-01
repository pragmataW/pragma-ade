import { type AppInfo, CoreIpc } from '../../common/core-ipc'
import type { MainHost } from './main-host'

export const RENDERER_READY_LOG = '[pragma] renderer ready'

/** `core.app.*`: the shell passes its real relaunch; tests pass a no-op. */
export function registerAppHandlers(
  host: Pick<MainHost, 'router' | 'log' | 'i18n'>,
  opts: { info: Omit<AppInfo, 'languages'>; relaunch(): void; onRendererReady?(): void },
): void {
  host.router.handle(CoreIpc.appInfo, () => ({ ...opts.info, languages: host.i18n.languages }))
  host.router.handle(CoreIpc.appRelaunch, () => opts.relaunch())
  host.router.handle(CoreIpc.appRendererReady, () => {
    host.log.info(RENDERER_READY_LOG)
    opts.onRendererReady?.()
  })
}
