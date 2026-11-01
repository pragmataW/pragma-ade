import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@pragma/ui/components/dropdown-menu'
import { Icon } from '@pragma/ui/components/icon'
import { useState } from 'react'
import { ICON_PX, SIZE, VARIANT } from '../../constants'
import { type ColumnDto, BOARD_TESTIDS as T } from '../../contract'
import { DeleteColumnDialog } from './DeleteColumnDialog'

/** Rename / Delete (disabled, with the reason, when it is the board's last column). */
export function ColumnMenu(props: { column: ColumnDto; columns: ColumnDto[]; taskCount: number; onRename(): void }) {
  const t = useT()
  const [deleting, setDeleting] = useState(false)
  const last = props.columns.length <= 1
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            data-testid={T.columnMenu}
            variant={VARIANT.ghost}
            size={SIZE.iconXs}
            aria-label={t('board:column.menu')}
            className="ml-auto"
          >
            <Icon name="ellipsis" size={ICON_PX.small} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem data-testid={T.columnRename} onSelect={props.onRename}>
            {t('board:column.rename')}
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid={T.columnDelete}
            disabled={last}
            title={last ? t('board:column.lastColumn') : undefined}
            onSelect={() => setDeleting(true)}
          >
            {t(last ? 'board:column.lastColumn' : 'board:column.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {deleting && (
        <DeleteColumnDialog
          column={props.column}
          columns={props.columns}
          taskCount={props.taskCount}
          onClose={() => setDeleting(false)}
        />
      )}
    </>
  )
}
