import { useT } from '@pragma/sdk/renderer'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@pragma/ui/components/select'
import { ALL_SCOPE_VALUE } from '../../constants'
import { SCOPE_KIND, BOARD_TESTIDS as T } from '../../contract'
import { parseScopeKey, scopeKey } from '../../lib/scope'
import { setScope, useBoardStore } from '../store'

/** Project picker: each project's board, or All projects. */
export function ScopePicker() {
  const t = useT()
  const scope = useBoardStore((s) => s.scope)
  const projects = useBoardStore((s) => s.projects)
  if (!scope) return null
  return (
    <Select value={scopeKey(scope)} onValueChange={(v) => void setScope(parseScopeKey(v))}>
      <SelectTrigger data-testid={T.scopePicker} aria-label={t('board:scope.label')} className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {projects.map((p) => (
          <SelectItem key={p.id} value={scopeKey({ kind: SCOPE_KIND.project, projectId: p.id })}>
            {p.name}
          </SelectItem>
        ))}
        <SelectItem value={ALL_SCOPE_VALUE}>{t('board:scope.all')}</SelectItem>
      </SelectContent>
    </Select>
  )
}
