import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ComponentProps } from 'react'
import { taskDndId } from '../lib/dnd'
import { TaskCard } from './TaskCard'

/** A card that can be dragged (pointer or keyboard: focus, Space, arrows, Space). */
export function SortableTaskCard(props: ComponentProps<typeof TaskCard>) {
  const sortable = useSortable({ id: taskDndId(props.task.id) })
  return (
    <div
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }}
      className={sortable.isDragging ? 'opacity-40' : undefined}
      {...sortable.attributes}
      {...sortable.listeners}
    >
      <TaskCard {...props} />
    </div>
  )
}
