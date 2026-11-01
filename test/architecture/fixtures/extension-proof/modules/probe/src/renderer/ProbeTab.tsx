import { useRendererContext, useT } from '@pragma/sdk/renderer'
import { AnchoredPopover } from '@pragma/ui/components/anchored-popover'
import { useRef, useSyncExternalStore } from 'react'
import { BADGE_CAPABILITY } from '../constants'
import { PROBE_TEST_IDS } from '../contract/testids'
import type { PopoverStore } from './popover-store'

/** Tab body plus one badge per provider with a renderer `badge` capability (no provider ids in code). */
export function ProbeTab({ popover }: { popover: PopoverStore }) {
  const t = useT()
  const ctx = useRendererContext()
  const anchor = useRef<HTMLDivElement>(null)
  const open = useSyncExternalStore(popover.subscribe, popover.get)
  const rect = anchor.current?.getBoundingClientRect() ?? { x: 0, y: 0, width: 0, height: 0 }
  return (
    <div className="p-2">
      <div ref={anchor} data-testid={PROBE_TEST_IDS.tabBody}>
        {t('probe:tab.body')}
      </div>
      <div className="mt-2 flex gap-2">
        {ctx.providers.providersWithRenderer(BADGE_CAPABILITY).map((p) => {
          const Badge = ctx.providers.rendererCapability(p.id, BADGE_CAPABILITY)?.Badge
          return (
            <span key={p.id} data-testid={PROBE_TEST_IDS.badge(p.id)}>
              {Badge && <Badge />}
            </span>
          )
        })}
      </div>
      <AnchoredPopover rect={rect} open={open} onOpenChange={popover.set}>
        <div data-testid={PROBE_TEST_IDS.popover}>{t('probe:popover.body')}</div>
      </AnchoredPopover>
    </div>
  )
}
