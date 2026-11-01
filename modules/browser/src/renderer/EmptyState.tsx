import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { Icon } from '@pragma/ui/components/icon'
import { DEFAULT_LOCALHOST_URL, EMPTY_ICON_PX, ICONS } from '../constants'
import { BrowserIpc, BROWSER_TEST_IDS as T } from '../contract'
import { send } from './lib/ipc'

/** No worktree selected, or no tabs (with a quick "Open localhost:3000"). */
export function EmptyState({ worktree }: { worktree: boolean }) {
  const t = useT()
  return (
    <div
      data-testid={T.emptyState}
      className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-[12.5px] text-[var(--mu)]"
    >
      <Icon name={ICONS.globe} size={EMPTY_ICON_PX} className="text-[var(--fa)]" />
      <span>{t(worktree ? 'browser:empty.noTabs' : 'browser:empty.noWorktree')}</span>
      {worktree ? (
        <Button
          size="sm"
          variant="outline"
          data-testid={T.openLocalhost}
          onClick={() => send(BrowserIpc.openTab, { url: DEFAULT_LOCALHOST_URL })}
        >
          {t('browser:empty.openLocalhost')}
        </Button>
      ) : null}
    </div>
  )
}
