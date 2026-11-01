import { useT } from '@pragma/sdk/renderer'
import { Icon } from '@pragma/ui/components/icon'
import { ALERT_ROLE, ICON_PX, ICONS } from '../../constants'
import { PROJECTS_TESTIDS as T } from '../../contract'
import { useRuntime, useUi } from '../lib/runtime'
import { useErrorText } from '../lib/use-error-text'
import { PlainButton } from './PlainButton'

/** The dismissible sidebar-level error (add project, remove project, select…). */
export function SidebarError() {
  const t = useT()
  const runtime = useRuntime()
  const error = useUi((s) => s.error)
  const text = useErrorText()
  if (!error) return null
  return (
    <div
      data-testid={T.error}
      role={ALERT_ROLE}
      className="mx-1.5 my-1 flex items-start gap-2 rounded-[var(--radius-card)] border border-err px-2 py-1.5 text-err text-[12px]"
    >
      <span className="min-w-0 flex-1 break-words">{text(error)}</span>
      <PlainButton
        data-testid={T.errorDismiss}
        aria-label={t('projects:sidebar.dismissError')}
        title={t('projects:sidebar.dismissError')}
        onClick={() => runtime.ui.setState({ error: null })}
      >
        <Icon name={ICONS.dismiss} size={ICON_PX.small} />
      </PlainButton>
    </div>
  )
}
