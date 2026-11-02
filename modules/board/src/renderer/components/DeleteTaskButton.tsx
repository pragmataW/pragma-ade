import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@pragma/ui/components/dialog'
import { useState } from 'react'
import { SIZE, VARIANT } from '../../constants'
import { BOARD_TESTIDS as T, type TaskDto } from '../../contract'
import { runAction } from '../lib/actions'
import { boardActions, select } from '../store'

/** Delete with a confirmation dialog. */
export function DeleteTaskButton({ task }: { task: TaskDto }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const confirm = () => {
    setOpen(false)
    select(null)
    runAction(boardActions.deleteTask(task.id))
  }
  return (
    <>
      <Button
        data-testid={T.drawerDelete}
        variant={VARIANT.ghost}
        size={SIZE.sm}
        className="self-start text-[var(--err)]"
        onClick={() => setOpen(true)}
      >
        {t('board:drawer.delete')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{t('board:drawer.delete')}</DialogTitle>
          <DialogDescription>{t('board:drawer.deleteConfirm', { key: task.key })}</DialogDescription>
          <DialogFooter>
            <Button variant={VARIANT.ghost} onClick={() => setOpen(false)}>
              {t('board:drawer.cancel')}
            </Button>
            <Button data-testid={T.drawerDeleteConfirm} variant={VARIANT.destructive} onClick={confirm}>
              {t('board:drawer.deleteConfirmButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
