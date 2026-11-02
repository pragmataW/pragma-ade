import { ALL_SCOPE_VALUE, PROJECT_SCOPE_PREFIX } from '../constants'
import { type BoardScope, SCOPE_KIND } from '../contract'

/** `all` or `project:<id>` (the `data-scope` attribute and the scope picker value). */
export const scopeKey = (scope: BoardScope): string =>
  scope.kind === SCOPE_KIND.all ? ALL_SCOPE_VALUE : `${PROJECT_SCOPE_PREFIX}${scope.projectId}`

export const parseScopeKey = (key: string): BoardScope =>
  key.startsWith(PROJECT_SCOPE_PREFIX)
    ? { kind: SCOPE_KIND.project, projectId: key.slice(PROJECT_SCOPE_PREFIX.length) }
    : { kind: SCOPE_KIND.all }
