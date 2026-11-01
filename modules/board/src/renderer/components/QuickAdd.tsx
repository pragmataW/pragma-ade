import { useT } from '@pragma/sdk/renderer'
import { Input } from '@pragma/ui/components/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@pragma/ui/components/select'
import { useState } from 'react'
import { ENTER_KEY, ESCAPE_KEY, SIZE } from '../../constants'
import { BOARD_TESTIDS as T } from '../../contract'
import { runAction } from '../lib/actions'
import { type BoardColumnModel, isMerged } from '../model'
import { boardActions, useBoardStore } from '../store'
import { PlainButton } from './PlainButton'

interface Target {
  projectId: string
  name: string
  columnId: number
}

/** Where this column can receive a new task: one project, or (All projects) every board that has the column. */
function useTargets(column: BoardColumnModel): Target[] {
  const sections = useBoardStore((s) => s.snapshot?.sections) ?? []
  return sections.flatMap((s) => {
    const columnId = isMerged(column)
      ? column.columnIdByBoard[s.board.id]
      : s.board.id === column.boardId
        ? column.id
        : undefined
    return columnId === undefined ? [] : [{ projectId: s.board.projectId, name: s.projectName, columnId }]
  })
}

function ProjectSelect(props: { targets: Target[]; value: string; onChange(v: string): void }) {
  const t = useT()
  return (
    <Select value={props.value} onValueChange={props.onChange}>
      <SelectTrigger data-testid={T.quickAddProject} size={SIZE.sm} aria-label={t('board:quickAdd.project')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {props.targets.map((x) => (
          <SelectItem key={x.projectId} value={x.projectId}>
            {x.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Bottom of a column: Enter adds at the end and keeps typing; Escape closes; empty input does nothing. */
export function QuickAdd({ column }: { column: BoardColumnModel }) {
  const t = useT()
  const targets = useTargets(column)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState<string | null>(null)
  const target = targets.find((x) => x.projectId === projectId) ?? targets[0]
  const submit = () => {
    if (!title.trim() || !target) return
    runAction(boardActions.createTask({ projectId: target.projectId, title, column: target.columnId }))
    setTitle('')
  }
  if (!open)
    return (
      <PlainButton
        data-testid={T.quickAdd}
        onClick={() => setOpen(true)}
        className="rounded-[var(--radius-button)] px-2 py-1 text-left text-[12px] text-[var(--fa)] hover:bg-[var(--hv)] hover:text-[var(--tx)]"
      >
        {t('board:quickAdd.button')}
      </PlainButton>
    )
  return (
    <div data-testid={T.quickAdd} className="flex flex-col gap-1">
      {isMerged(column) && target && (
        <ProjectSelect targets={targets} value={target.projectId} onChange={setProjectId} />
      )}
      <Input
        data-testid={T.quickAddInput}
        autoFocus
        value={title}
        placeholder={t('board:quickAdd.placeholder')}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === ENTER_KEY) submit()
          if (e.key === ESCAPE_KEY) setOpen(false)
        }}
      />
    </div>
  )
}
