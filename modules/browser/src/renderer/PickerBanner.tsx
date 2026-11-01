import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { GHOST_VARIANT, TAB_STRIP_PX } from '../constants'
import { BrowserIpc, BROWSER_TEST_IDS as T } from '../contract'
import { send } from './lib/ipc'

/** Replaces the tab strip (same height) while the picker is armed on the active tab. */
export function PickerBanner({ tabId }: { tabId: string }) {
  const t = useT()
  return (
    <div
      data-testid={T.pickerBanner}
      role="status"
      style={{ height: TAB_STRIP_PX }}
      className="flex shrink-0 items-center gap-2 border-b border-[var(--ac)] bg-[var(--acs)] px-2 text-[12px] text-[var(--act)]"
    >
      <span className="min-w-0 flex-1 truncate">{t('browser:picker.banner')}</span>
      <Button
        size="xs"
        variant={GHOST_VARIANT}
        data-testid={T.pickerCancel}
        onClick={() => send(BrowserIpc.pickerCancel, { tabId })}
      >
        {t('browser:picker.cancel')}
      </Button>
    </div>
  )
}
