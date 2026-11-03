import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { Icon } from '@pragma/ui/components/icon'
import { ICON_PX, SIZE } from '../../constants'
import { BOARD_TESTIDS as T } from '../../contract'
import { runAction } from '../lib/actions'
import { boardActions, select, useBoardStore } from '../store'

/** Creates "Untitled task" in the first column of the scope's (first) project, then opens it. */
export function useCreateTask(): { create(): void; disabled: boolean } {
  const t = useT()
  const projectId = useBoardStore((s) => s.snapshot?.sections[0]?.board.projectId)
  const create = async () => {
    if (!projectId) return
    const task = await boardActions.createTask({ projectId, title: t('board:card.untitled') })
    select(task.id)
  }
  return { create: () => runAction(create()), disabled: !projectId }
}

/** The header's "New task" button. */
export function NewTaskButton() {
  const t = useT()
  const { create, disabled } = useCreateTask()
  return (
    <Button data-testid={T.newTask} size={SIZE.sm} disabled={disabled} onClick={create}>
      <Icon name="plus" size={ICON_PX.row} />
      {t('board:newTask')}
    </Button>
  )
}
