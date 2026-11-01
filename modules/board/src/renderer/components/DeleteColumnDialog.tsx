import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@pragma/ui/components/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@pragma/ui/components/select'
import { useState } from 'react'
import { VARIANT } from '../../constants'
import { type ColumnDto, BOARD_TESTIDS as T } from '../../contract'
import { runAction } from '../lib/actions'
import { boardActions } from '../store'

/** The default target: the previous column, else the next one. */
const defaultTarget = (column: ColumnDto, columns: ColumnDto[]): ColumnDto | undefined => {
  const i = columns.findIndex((c) => c.id === column.id)
  return columns[i - 1] ?? columns[i + 1]
}

/** Confirms a column delete; a non-empty column asks where its tasks go. */
export function DeleteColumnDialog(props: {
  column: ColumnDto
  columns: ColumnDto[]
  taskCount: number
  onClose(): void
}) {
  const t = useT()
  const { column, taskCount } = props
  const others = props.columns.filter((c) => c.id !== column.id)
  const [target, setTarget] = useState(defaultTarget(column, props.columns)?.id)
  const confirm = () => {
    props.onClose()
    runAction(boardActions.deleteColumn(column.id, taskCount > 0 ? target : undefined))
  }
  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent data-testid={T.deleteColumnDialog}>
        <DialogTitle>{t('board:column.deleteTitle', { name: column.name })}</DialogTitle>
        <DialogDescription>
          {taskCount > 0 ? t('board:column.deleteMove', { count: taskCount }) : t('board:column.deleteEmpty')}
        </DialogDescription>
        {taskCount > 0 && (
          <Select value={String(target)} onValueChange={(v) => setTarget(Number(v))}>
            <SelectTrigger data-testid={T.deleteColumnTarget} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {others.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <DialogFooter>
          <Button variant={VARIANT.ghost} onClick={props.onClose}>
            {t('board:column.cancel')}
          </Button>
          <Button data-testid={T.deleteColumnConfirm} variant={VARIANT.destructive} onClick={confirm}>
            {t('board:column.deleteConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
