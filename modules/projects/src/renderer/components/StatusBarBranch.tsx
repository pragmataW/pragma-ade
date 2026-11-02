import { useT } from '@pragma/sdk/renderer'
import { Icon } from '@pragma/ui/components/icon'
import { ICON_PX, ICONS, STATUS_PART_SEPARATOR } from '../../constants'
import { PROJECTS_TESTIDS as T, type WorktreeSyncState } from '../../contract'
import { useProjects } from '../lib/runtime'
import { selectActiveWorktree } from '../store'

function AheadBehind({ sync }: { sync: WorktreeSyncState }) {
  const t = useT()
  if (sync.upstream === null)
    return <span data-testid={T.statusbarAheadBehind}>{t('projects:statusbar.noUpstream')}</span>
  const ahead = sync.ahead ?? 0
  const behind = sync.behind ?? 0
  const parts = [
    ahead > 0 ? t('projects:statusbar.ahead', { count: ahead }) : null,
    behind > 0 ? t('projects:statusbar.behind', { count: behind }) : null,
  ].filter((p): p is string => p !== null)
  if (parts.length === 0) return null
  return (
    <span
      data-testid={T.statusbarAheadBehind}
      title={t('projects:statusbar.aheadBehindTooltip', { ahead, behind, upstream: sync.upstream })}
    >
      {parts.join(STATUS_PART_SEPARATOR)}
    </span>
  )
}

/** `statusbar.left` (first item): active branch + ahead/behind its upstream. */
export function StatusBarBranch() {
  const t = useT()
  const active = useProjects(selectActiveWorktree)
  const sync = useProjects((s) => (active ? s.sync[active.id] : undefined))
  if (!active) return null
  const branch = active.branch ?? t('projects:sidebar.detached')
  return (
    <>
      <span
        data-testid={T.statusbarBranch}
        title={t('projects:statusbar.branch', { branch })}
        className="flex items-center gap-1"
      >
        <Icon name={ICONS.branch} size={ICON_PX.small} />
        <span className="font-mono">{branch}</span>
      </span>
      {sync && <AheadBehind sync={sync} />}
    </>
  )
}
