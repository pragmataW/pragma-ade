import { CommentsDrawer } from './CommentsDrawer'
import { LaunchSuggestionDialog } from './LaunchSuggestionDialog'
import { TargetPickerDialog } from './TargetPickerDialog'

/**
 * `titlebar.right`, but nothing visible: it keeps the drawer and both dialogs always mounted (they portal out), so
 * they work without an agent session. The only entry button is the session toolbar's `ToolbarBadge`.
 */
export function CommentsHost() {
  return (
    <>
      <CommentsDrawer />
      <TargetPickerDialog />
      <LaunchSuggestionDialog />
    </>
  )
}
