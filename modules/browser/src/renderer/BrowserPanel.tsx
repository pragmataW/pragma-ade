import { useT } from '@pragma/sdk/renderer'
import { useLayoutEffect, useRef, useState } from 'react'
import { type Rect, BROWSER_TEST_IDS as T } from '../contract'
import { EmptyState } from './EmptyState'
import { PickerBanner } from './PickerBanner'
import { PickPopover } from './PickPopover'
import { useBrowser } from './runtime'
import { activeTab, activeTabs } from './store'
import { TabStrip } from './TabStrip'
import { Toolbar } from './Toolbar'

const RESIZE = 'resize'

/** The view area's window rect (the SDK places the native view over it; the pick popover is positioned from it). */
function useAreaRect(ref: React.RefObject<HTMLDivElement | null>): Rect {
  const [rect, setRect] = useState<Rect>({ x: 0, y: 0, width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setRect((old) =>
        old.x === r.x && old.y === r.y && old.width === r.width && old.height === r.height
          ? old
          : { x: r.x, y: r.y, width: r.width, height: r.height },
      )
    }
    measure()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    observer?.observe(el)
    window.addEventListener(RESIZE, measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener(RESIZE, measure)
    }
  }, [ref])
  return rect
}

function ViewArea() {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  const area = useAreaRect(ref)
  const tab = useBrowser(activeTab)
  const hasTabs = useBrowser((s) => activeTabs(s).length > 0)
  const pick = useBrowser((s) => s.pick)
  return (
    <div ref={ref} data-testid={T.viewArea} className="relative min-h-0 flex-1 bg-[var(--bg)]">
      {hasTabs ? null : <EmptyState worktree />}
      {tab?.loadError ? (
        <div data-testid={T.loadError} className="p-6 text-center text-[12.5px] text-[var(--mu)]">
          {t('browser:error.loadFailed', { description: tab.loadError.description })}
        </div>
      ) : null}
      {pick && pick.tabId === tab?.id ? <PickPopover key={pick.pickId} pick={pick} area={area} /> : null}
    </div>
  )
}

/** Right-panel tab `browser`: tab strip (or picker banner), toolbar, and the area the page view covers. */
export function BrowserPanel() {
  const worktree = useBrowser((s) => s.snapshot?.activeWorktreeId ?? null)
  const tab = useBrowser(activeTab)
  const armed = useBrowser((s) => tab !== null && s.snapshot?.pickerArmedTabId === tab.id)
  return (
    <div data-testid={T.panel} className="flex h-full min-h-0 flex-col bg-[var(--pn)]">
      {worktree ? (
        <>
          {armed && tab ? <PickerBanner tabId={tab.id} /> : <TabStrip />}
          <Toolbar tab={tab} />
          <ViewArea />
        </>
      ) : (
        <EmptyState worktree={false} />
      )}
    </div>
  )
}
