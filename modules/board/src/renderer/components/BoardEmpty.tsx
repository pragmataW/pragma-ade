import { projectsCommands } from '@pragma/module-projects/contract'
import { useT } from '@pragma/sdk/renderer'
import { EmptyState } from '@pragma/ui'
import { EMPTY_ICONS } from '../../constants'
import { BOARD_TESTIDS as T } from '../../contract'
import { runAction } from '../lib/actions'
import { boardCtx } from '../lib/runtime'
import { isFilterActive } from '../model'
import { clearFilter, useBoardStore } from '../store'
import { useCreateTask } from './NewTaskButton'

/** No project yet: the board needs one, so offer to add it. */
export function NoProjects() {
  const t = useT()
  return (
    <EmptyState
      testId={T.emptyProjects}
      icon={EMPTY_ICONS.noProjects}
      title={t('board:empty.noProjectsTitle')}
      description={t('board:empty.noProjects')}
      primaryAction={{
        label: t('board:empty.addProject'),
        icon: EMPTY_ICONS.add,
        onClick: () => runAction(boardCtx().commands.execute(projectsCommands.addProject.id)),
      }}
    />
  )
}

/** List mode with no rows: nothing matches the filter (clear it), or the board has no tasks yet (create one). */
export function NoTasks() {
  const t = useT()
  const filtered = useBoardStore((s) => isFilterActive(s.filter))
  const { create, disabled } = useCreateTask()
  if (filtered)
    return (
      <EmptyState
        testId={T.listEmpty}
        compact
        icon={EMPTY_ICONS.noMatches}
        title={t('board:list.empty')}
        description={t('board:list.emptyFilteredHint')}
        secondaryAction={{ label: t('board:filter.clear'), onClick: clearFilter }}
      />
    )
  return (
    <EmptyState
      testId={T.listEmpty}
      compact
      icon={EMPTY_ICONS.noTasks}
      title={t('board:empty.noTasks')}
      description={t('board:empty.noTasksHint')}
      primaryAction={disabled ? undefined : { label: t('board:newTask'), icon: EMPTY_ICONS.add, onClick: create }}
    />
  )
}
