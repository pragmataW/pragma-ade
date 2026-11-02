import { CoreIpc } from '@pragma/sdk'
import type { RendererHost } from '@pragma/sdk/runtime/renderer'
import { useEffect, useState } from 'react'

/** Whether the window is fullscreen: asked once, then kept current by `core.window.fullScreenChanged`. */
export function useFullScreen(host: Pick<RendererHost, 'ipc'>): boolean {
  const [fullScreen, setFullScreen] = useState(false)
  useEffect(() => {
    let live = true
    const sub = host.ipc.subscribe(CoreIpc.windowFullScreenChanged, setFullScreen)
    void host.ipc.invoke(CoreIpc.windowFullScreen, undefined).then((v) => live && setFullScreen(v))
    return () => {
      live = false
      sub.dispose()
    }
  }, [host])
  return fullScreen
}
