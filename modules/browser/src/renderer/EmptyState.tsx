import { useT } from '@pragma/sdk/renderer'
import { EmptyState as UiEmptyState } from '@pragma/ui'
import { DEFAULT_LOCALHOST_URL, ICONS } from '../constants'
import { BrowserIpc, BROWSER_TEST_IDS as T } from '../contract'
import { send } from './lib/ipc'

/** No worktree selected, or no tabs (with a quick "Open localhost:3000"). */
export function EmptyState({ worktree }: { worktree: boolean }) {
  const t = useT()
  if (!worktree)
    return (
      <UiEmptyState
        testId={T.emptyState}
        icon={ICONS.noWorktree}
        title={t('browser:empty.noWorktreeTitle')}
        description={t('browser:empty.noWorktree')}
      />
    )
  return (
    <UiEmptyState
      testId={T.emptyState}
      icon={ICONS.globe}
      title={t('browser:empty.noTabs')}
      description={t('browser:empty.noTabsHint')}
      primaryAction={{
        label: t('browser:empty.openLocalhost'),
        icon: ICONS.add,
        testId: T.openLocalhost,
        onClick: () => send(BrowserIpc.openTab, { url: DEFAULT_LOCALHOST_URL }),
      }}
    />
  )
}
