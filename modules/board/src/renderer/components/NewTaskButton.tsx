import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { Icon } from '@pragma/ui/components/icon'
import { ICON_PX, SIZE } from '../../constants'
import { BOARD_TESTIDS as T } from '../../contract'
import { runAction } from '../lib/actions'
import { boardActions, select, useBoardStore } from '../store'

/** "Untitled task" in the first column of the scope's (first) project, then opens it. */
export function NewTaskButton() {
  const t = useT()
  const projectId = useBoardStore((s) => s.snapshot?.sections[0]?.board.projectId)
  const create = async () => {
    if (!projectId) return
    const task = await boardActions.createTask({ projectId, title: t('board:card.untitled') })
    select(task.id)
  }
  return (
    <Button data-testid={T.newTask} size={SIZE.sm} disabled={!projectId} onClick={() => runAction(create())}>
      <Icon name="plus" size={ICON_PX.row} />
      {t('board:newTask')}
    </Button>
  )
}
