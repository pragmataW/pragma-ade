import { useT } from '@pragma/sdk/renderer'
import { ERROR_KEY_PREFIX } from '../../constants'
import type { ProjectsErrorDto } from '../../contract'

/** `projects:errors.<code>` with the git detail interpolated. */
export function useErrorText(): (e: ProjectsErrorDto) => string {
  const t = useT()
  return (e) => t(`${ERROR_KEY_PREFIX}${e.code}`, { detail: e.detail ?? '' })
}
