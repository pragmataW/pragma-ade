import { useT } from '@pragma/sdk/renderer'
import { COMMENTS_TESTIDS as T } from '../../contract'
import { useCommentsStore } from '../store'
import { CommentsDrawer } from './CommentsDrawer'
import { CommentsIconButton } from './CommentsIconButton'
import { LaunchSuggestionDialog } from './LaunchSuggestionDialog'
import { TargetPickerDialog } from './TargetPickerDialog'

/** `titlebar.right`: the drafts button; it also hosts the drawer and both dialogs, so they are always mounted. */
export function TitlebarEntry() {
  const t = useT()
  const count = useCommentsStore((s) => s.drafts.length)
  const label = count ? t('comments:titlebar.badge', { count }) : t('comments:titlebar.open')
  return (
    <>
      <CommentsIconButton
        count={count}
        label={label}
        testId={T.titlebarButton}
        onClick={() => useCommentsStore.getState().openDrawer()}
      />
      <CommentsDrawer />
      <TargetPickerDialog />
      <LaunchSuggestionDialog />
    </>
  )
}
