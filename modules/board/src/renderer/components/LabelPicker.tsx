import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Input } from '@pragma/ui/components/input'
import { useState } from 'react'
import { ENTER_KEY } from '../../constants'
import { type LabelDto, type LabelRef, BOARD_TESTIDS as T, type TaskDto } from '../../contract'
import { LabelChip } from './LabelChip'
import { PlainButton } from './PlainButton'

/** Toggle the board's labels; a typed new name + Enter creates it (labels are refs: ids or new names). */
export function LabelPicker(props: { task: TaskDto; labels: LabelDto[]; onChange(labels: LabelRef[]): void }) {
  const t = useT()
  const [name, setName] = useState('')
  const { task } = props
  const toggle = (id: number) =>
    props.onChange(task.labelIds.includes(id) ? task.labelIds.filter((x) => x !== id) : [...task.labelIds, id])
  return (
    <div data-testid={T.drawerLabels} className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1">
        {props.labels.map((l) => (
          <PlainButton
            key={l.id}
            aria-pressed={task.labelIds.includes(l.id)}
            aria-label={t('board:labels.toggle', { name: l.name })}
            onClick={() => toggle(l.id)}
            className={cn('rounded-[var(--radius-chip)]', !task.labelIds.includes(l.id) && 'opacity-50')}
          >
            <LabelChip label={l} />
          </PlainButton>
        ))}
      </div>
      <Input
        data-testid={T.drawerLabelInput}
        value={name}
        placeholder={t('board:labels.create')}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== ENTER_KEY || !name.trim()) return
          props.onChange([...task.labelIds, name.trim()])
          setName('')
        }}
      />
    </div>
  )
}
