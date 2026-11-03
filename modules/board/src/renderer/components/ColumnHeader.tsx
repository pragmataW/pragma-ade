import type { DraggableSyntheticListeners } from '@dnd-kit/core'
import { useT } from '@pragma/sdk/renderer'
import { Icon } from '@pragma/ui/components/icon'
import { Input } from '@pragma/ui/components/input'
import { type ReactNode, useState } from 'react'
import { ENTER_KEY, ESCAPE_KEY, ICON_PX } from '../../constants'
import { BOARD_ERROR, type ColumnDto, BOARD_TESTIDS as T } from '../../contract'
import { errorNotice } from '../lib/errors'
import { boardActions, isBoardError, setError } from '../store'
import { ColumnDescriptionDialog } from './ColumnDescriptionDialog'
import { ColumnMenu } from './ColumnMenu'
import { PlainButton } from './PlainButton'

function RenameInput({ column, onDone }: { column: ColumnDto; onDone(): void }) {
  const t = useT()
  const [name, setName] = useState(column.name)
  const [duplicate, setDuplicate] = useState(false)
  const save = async () => {
    if (!name.trim() || name.trim() === column.name) return onDone()
    try {
      await boardActions.renameColumn(column.id, name)
      onDone()
    } catch (e) {
      if (isBoardError(e, BOARD_ERROR.duplicate_column_name)) setDuplicate(true)
      else setError(errorNotice(e))
    }
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <Input
        data-testid={T.columnRenameInput}
        autoFocus
        value={name}
        aria-invalid={duplicate}
        onChange={(e) => {
          setName(e.target.value)
          setDuplicate(false)
        }}
        onKeyDown={(e) => {
          if (e.key === ENTER_KEY) void save()
          if (e.key === ESCAPE_KEY) onDone()
        }}
      />
      {duplicate && (
        <span data-testid={T.columnError} className="text-[11px] text-[var(--err)]">
          {t('board:column.duplicate')}
        </span>
      )}
    </div>
  )
}

/** Drag handle, name (inline rename), description icon, count and the column menu; project scope only. */
export function ColumnHeader(props: {
  column: ColumnDto
  columns: ColumnDto[]
  taskCount: number
  /** The visible-card count, drawn right after the name (ui-notes: name · count … menu). */
  count: ReactNode
  handle: DraggableSyntheticListeners
}) {
  const t = useT()
  const [renaming, setRenaming] = useState(false)
  const [describing, setDescribing] = useState(false)
  const { column } = props
  return (
    <>
      <PlainButton
        data-testid={T.columnHandle}
        aria-label={t('board:column.drag', { name: column.name })}
        className="cursor-grab text-[var(--fa)] hover:text-[var(--tx)]"
        {...props.handle}
      >
        <Icon name="grip-vertical" size={ICON_PX.small} />
      </PlainButton>
      {renaming ? (
        <RenameInput column={column} onDone={() => setRenaming(false)} />
      ) : (
        <span className="truncate font-medium text-[12.5px]">{column.name}</span>
      )}
      {column.description && (
        <PlainButton
          data-testid={T.columnDescription}
          title={column.description}
          aria-label={t('board:column.editDescription')}
          className="shrink-0 text-[var(--fa)] hover:text-[var(--tx)]"
          onClick={() => setDescribing(true)}
        >
          <Icon name="info" size={ICON_PX.small} />
        </PlainButton>
      )}
      {props.count}
      <ColumnMenu
        column={column}
        columns={props.columns}
        taskCount={props.taskCount}
        onRename={() => setRenaming(true)}
        onEditDescription={() => setDescribing(true)}
      />
      {describing && <ColumnDescriptionDialog column={column} onClose={() => setDescribing(false)} />}
    </>
  )
}
