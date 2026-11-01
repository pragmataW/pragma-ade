import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { APP_DIR_NAMES } from '@pragma/sdk'
import { defineTestHooks } from '@pragma/sdk/main'
import type { WebContentsView } from 'electron'
import {
  DISPOSED_MARKER,
  PROBE_ID,
  PROBE_INSET_TOP_PX,
  PROBE_PROVIDER_ID,
  PROBE_VIEW_ID,
  PROBE_VIEW_URL,
} from '../constants'
import { ProbeIpc } from '../contract'

export class ProbeViewNotOpenError extends Error {}

/** Test-only channels (loaded when PRAGMA_TEST=1): a real WebContentsView attached to the probe tab. */
export default defineTestHooks((ctx) => {
  let view: WebContentsView | undefined
  ctx.ipc.handle(ProbeIpc.testHookActive, () => true)
  ctx.ipc.handle(ProbeIpc.openNativeView, async () => {
    const { WebContentsView: View } = await import('electron')
    view = new View()
    void view.webContents.loadURL(PROBE_VIEW_URL)
    ctx.nativeViews.attach(PROBE_VIEW_ID, view, { panelTabId: PROBE_ID, inset: { top: PROBE_INSET_TOP_PX } })
  })
  ctx.ipc.handle(ProbeIpc.nativeViewState, () => {
    if (!view) throw new ProbeViewNotOpenError(PROBE_VIEW_ID)
    return { bounds: view.getBounds(), visible: view.getVisible() }
  })
  ctx.ipc.handle(ProbeIpc.capabilityDisposed, () =>
    existsSync(join(ctx.paths.userData, APP_DIR_NAMES.providers, PROBE_PROVIDER_ID, DISPOSED_MARKER)),
  )
})
