import { ALERT_ROLE } from '../../constants'
import type { ProjectsErrorDto } from '../../contract'
import { useErrorText } from '../lib/use-error-text'

/** An inline error line (`role={ALERT_ROLE}`) for a failed projects action; nothing when there is no error. */
export function ErrorText({ error, testId }: { error: ProjectsErrorDto | null; testId?: string }) {
  const text = useErrorText()
  if (!error) return null
  return (
    <p data-testid={testId} role={ALERT_ROLE} className="text-[12px] text-err">
      {text(error)}
    </p>
  )
}
