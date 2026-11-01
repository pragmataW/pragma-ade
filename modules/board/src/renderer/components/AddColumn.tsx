import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { Icon } from '@pragma/ui/components/icon'
import { Input } from '@pragma/ui/components/input'
import { useState } from 'react'
import { ENTER_KEY, ESCAPE_KEY, ICON_PX, SIZE, VARIANT } from '../../constants'
import { SCOPE_KIND, BOARD_TESTIDS as T } from '../../contract'
import { runAction } from '../lib/actions'
import { boardActions, useBoardStore } from '../store'

/** Header button → inline input; Enter adds the column at the end (project scope only). */
export function AddColumn() {
  const t = useT()
  const scope = useBoardStore((s) => s.scope)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  if (scope?.kind !== SCOPE_KIND.project) return null
  const submit = () => {
    if (name.trim()) runAction(boardActions.createColumn(scope.projectId, name))
    setName('')
    setEditing(false)
  }
  if (editing)
    return (
      <Input
        data-testid={T.addColumnInput}
        autoFocus
        value={name}
        placeholder={t('board:column.addPlaceholder')}
        className="w-40"
        onChange={(e) => setName(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === ENTER_KEY) submit()
          if (e.key === ESCAPE_KEY) setEditing(false)
        }}
      />
    )
  return (
    <Button data-testid={T.addColumn} variant={VARIANT.ghost} size={SIZE.sm} onClick={() => setEditing(true)}>
      <Icon name="columns-3" size={ICON_PX.row} />
      {t('board:column.add')}
    </Button>
  )
}
