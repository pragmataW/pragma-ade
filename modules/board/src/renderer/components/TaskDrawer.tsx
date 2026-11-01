import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { Icon } from '@pragma/ui/components/icon'
import { Input } from '@pragma/ui/components/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@pragma/ui/components/select'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@pragma/ui/components/sheet'
import { useState } from 'react'
import { DATE_TIME_FORMAT, ENTER_KEY, ICON_PX, SIZE, VARIANT } from '../../constants'
import {
  type BoardSection,
  PRIORITIES,
  type Priority,
  BOARD_TESTIDS as T,
  type TaskDto,
  type UpdateTaskPatch,
} from '../../contract'
import { runAction } from '../lib/actions'
import { formatDateTime } from '../lib/labels'
import { useSection, useSelectedTask } from '../lib/use-board'
import { boardActions, select } from '../store'
import { DeleteTaskButton } from './DeleteTaskButton'
import { DescriptionField } from './DescriptionField'
import { Field } from './Field'
import { LabelPicker } from './LabelPicker'

const update = (task: TaskDto, patch: UpdateTaskPatch) => runAction(boardActions.updateTask(task.id, patch))

function TitleInput({ task }: { task: TaskDto }) {
  const t = useT()
  const [draft, setDraft] = useState(task.title)
  const save = () => {
    if (draft.trim() && draft !== task.title) update(task, { title: draft })
  }
  return (
    <Input
      data-testid={T.drawerTitle}
      aria-label={t('board:drawer.title')}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === ENTER_KEY && save()}
      className="font-semibold text-[17px]"
    />
  )
}

function StatusSelect({ task, section }: { task: TaskDto; section: BoardSection }) {
  return (
    <Select value={String(task.columnId)} onValueChange={(v) => runAction(boardActions.moveTask(task.id, Number(v)))}>
      <SelectTrigger data-testid={T.drawerStatus} size={SIZE.sm} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {section.columns.map((c) => (
          <SelectItem key={c.id} value={String(c.id)}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function PrioritySelect({ task }: { task: TaskDto }) {
  const t = useT()
  return (
    <Select value={task.priority} onValueChange={(v) => update(task, { priority: v as Priority })}>
      <SelectTrigger data-testid={T.drawerPriority} size={SIZE.sm} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PRIORITIES.map((p) => (
          <SelectItem key={p} value={p}>
            {t(`board:priority.${p}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function DrawerBody({ task, section }: { task: TaskDto; section: BoardSection }) {
  const t = useT()
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <span data-testid={T.drawerKeyChip} className="font-mono text-[12px] text-[var(--mu)]">
          {task.key}
        </span>
        <SheetDescription className="sr-only">{section.projectName}</SheetDescription>
        <Button
          data-testid={T.drawerClose}
          variant={VARIANT.ghost}
          size={SIZE.iconSm}
          aria-label={t('board:drawer.close')}
          className="ml-auto"
          onClick={() => select(null)}
        >
          <Icon name="x" size={ICON_PX.row} />
        </Button>
      </div>
      <TitleInput task={task} />
      <div className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2">
        <Field label={t('board:drawer.status')}>
          <StatusSelect task={task} section={section} />
        </Field>
        <Field label={t('board:drawer.priority')}>
          <PrioritySelect task={task} />
        </Field>
        <Field label={t('board:drawer.labels')}>
          <LabelPicker task={task} labels={section.labels} onChange={(labels) => update(task, { labels })} />
        </Field>
      </div>
      <DescriptionField value={task.descriptionMd} onSave={(descriptionMd) => update(task, { descriptionMd })} />
      <div className="flex flex-col gap-0.5 text-[11px] text-[var(--fa)]">
        <span>{t('board:drawer.created', { date: formatDateTime(task.createdAt, DATE_TIME_FORMAT) })}</span>
        <span>{t('board:drawer.updated', { date: formatDateTime(task.updatedAt, DATE_TIME_FORMAT) })}</span>
      </div>
      <DeleteTaskButton task={task} />
    </div>
  )
}

/** 420px drawer over the right edge for the selected card. */
export function TaskDrawer() {
  const task = useSelectedTask()
  const section = useSection(task?.boardId)
  return (
    <Sheet open={task !== null && section !== undefined} onOpenChange={(open) => !open && select(null)}>
      <SheetContent data-testid={T.drawer} className="board-drawer gap-0 bg-[var(--el)] p-0 sm:max-w-none">
        <SheetTitle className="sr-only">{task?.title}</SheetTitle>
        {task && section && <DrawerBody key={task.id} task={task} section={section} />}
      </SheetContent>
    </Sheet>
  )
}
