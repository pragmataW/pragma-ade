import { CoreIpc, type NativeSnapshot, ShellTestIds as T } from '@pragma/sdk'
import { useRendererHost } from '@pragma/sdk/renderer'
import { useEffect, useState } from 'react'

/** Paints frozen/occluded native views as images at their last rect (§10.2 overlay protection). */
export function NativeSnapshots() {
  const { ipc } = useRendererHost()
  const [snapshots, setSnapshots] = useState<Record<string, NativeSnapshot>>({})
  useEffect(() => {
    const shown = ipc.subscribe(CoreIpc.nativeViewsSnapshot, (s) => setSnapshots((all) => ({ ...all, [s.viewId]: s })))
    const cleared = ipc.subscribe(CoreIpc.nativeViewsSnapshotCleared, ({ viewId }) =>
      setSnapshots(({ [viewId]: _gone, ...rest }) => rest),
    )
    return () => {
      shown.dispose()
      cleared.dispose()
    }
  }, [ipc])
  return (
    <>
      {Object.values(snapshots).map((s) => (
        <img
          key={s.viewId}
          src={s.dataUrl}
          alt=""
          data-testid={T.nativeSnapshot(s.viewId)}
          className="pointer-events-none fixed z-0"
          style={{ left: s.bounds.x, top: s.bounds.y, width: s.bounds.width, height: s.bounds.height }}
        />
      ))}
    </>
  )
}
