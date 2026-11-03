import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@pragma/ui/components/dialog'
import { useState } from 'react'
import { COLUMN_DESCRIPTION_ROWS, ENTER_KEY, VARIANT } from '../../constants'
import { type ColumnDto, LIMITS, BOARD_TESTIDS as T } from '../../contract'
import { runAction } from '../lib/actions'
import { boardActions } from '../store'

/** Edits a column's plain-text description (what agents read to pick a task's column); '' clears it. */
export function ColumnDescriptionDialog(props: { column: ColumnDto; onClose(): void }) {
  const t = useT()
  const { column } = props
  const [draft, setDraft] = useState(column.description)
  const save = () => {
    props.onClose()
    if (draft.trim() !== column.description) runAction(boardActions.setColumnDescription(column.id, draft))
  }
  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent data-testid={T.columnDescriptionDialog}>
        <DialogTitle>{t('board:column.descriptionTitle', { name: column.name })}</DialogTitle>
        <DialogDescription>{t('board:column.descriptionHelp')}</DialogDescription>
        <textarea
          data-testid={T.columnDescriptionInput}
          autoFocus
          value={draft}
          rows={COLUMN_DESCRIPTION_ROWS}
          maxLength={LIMITS.columnDescriptionMax}
          placeholder={t('board:column.descriptionPlaceholder')}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === ENTER_KEY && (e.metaKey || e.ctrlKey)) save()
          }}
          className="w-full resize-y rounded-[var(--radius-button)] border border-[var(--bd2)] bg-transparent p-2 text-[12.5px] text-[var(--tx)] outline-none placeholder:text-[var(--fa)] focus:border-[var(--ac)]"
        />
        <DialogFooter>
          <Button variant={VARIANT.ghost} onClick={props.onClose}>
            {t('board:column.cancel')}
          </Button>
          <Button data-testid={T.columnDescriptionSave} onClick={save}>
            {t('board:column.descriptionSave')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
