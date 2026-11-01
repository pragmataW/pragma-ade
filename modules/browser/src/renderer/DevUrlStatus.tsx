import { useT } from '@pragma/sdk/renderer'
import { BUTTON_TYPE, RIGHT_TAB_ID } from '../constants'
import { BROWSER_TEST_IDS as T } from '../contract'
import { devUrlLabel } from './lib/dev-url'
import { runtime, useBrowser } from './runtime'
import { activeTab } from './store'

/** `statusbar.right`: a green dot and `host:port` while the active tab shows a local dev server. */
export function DevUrlStatus() {
  const t = useT()
  const label = useBrowser((s) => devUrlLabel(activeTab(s)))
  if (!label) return null
  return (
    <button
      type={BUTTON_TYPE}
      data-testid={T.devUrlStatus}
      title={t('browser:status.devUrl')}
      onClick={() => runtime().ctx.panels.activateRightTab(RIGHT_TAB_ID)}
      className="flex items-center gap-1.5 px-1.5 font-mono text-[11px] text-[var(--mu)] hover:text-[var(--tx)]"
    >
      <span className="size-1.5 rounded-full bg-[var(--ok)]" />
      {label}
    </button>
  )
}
