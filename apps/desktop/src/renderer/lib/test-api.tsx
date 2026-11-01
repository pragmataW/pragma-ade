import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import {
  type PragmaTestApi,
  type PragmaTestWindow,
  ShellTestIds as T,
  TEST_SORTABLE_ITEMS,
  TEST_TAB_FIXTURES,
} from '@pragma/sdk'
import { useT } from '@pragma/sdk/renderer'
import type { RendererHost } from '@pragma/sdk/runtime/renderer'
import { useState } from 'react'

export type { PragmaTestApi, PragmaTestWindow } from '@pragma/sdk'

const TEST_TAB_ICON = 'flask-conical'
const PX = 'px'

function TestTabBody({ tabId, titleKey }: { tabId: string; titleKey: string }) {
  const t = useT()
  return <div data-testid={T.testTabBody(tabId)}>{t(titleKey)}</div>
}

function SortableRow({ item }: { item: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item })
  const style = { transform: transform ? `translate3d(0, ${transform.y}${PX}, 0)` : undefined, transition }
  return (
    <li
      ref={setNodeRef}
      style={style}
      data-testid={T.testSortableItem(item)}
      className="h-8 border-b border-[var(--bd)] px-2 leading-8"
      {...attributes}
      {...listeners}
    >
      {item}
    </li>
  )
}

/** A dnd-kit sortable list (pointer sensor, default 5px activation) that `dragTo` E2E tests drive. */
export function TestSortable({ tabId }: { tabId: string }) {
  const [items, setItems] = useState<string[]>([...TEST_SORTABLE_ITEMS])
  const sensors = useSensors(useSensor(PointerSensor))
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setItems((list) => arrayMove(list, list.indexOf(String(active.id)), list.indexOf(String(over.id))))
  }
  return (
    <div data-testid={T.testTabBody(tabId)}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <ul data-testid={T.testSortable(tabId)}>
            {items.map((item) => (
              <SortableRow key={item} item={item} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  )
}

/** `window.__pragmaTest` (test mode only): lets E2E register tabs and run commands without a module. */
export function installTestApi(host: RendererHost): void {
  const api: PragmaTestApi = {
    registerRightTab({ id, titleKey, order, fixture }) {
      host.registries.registerRightTab({
        id,
        titleKey,
        order,
        icon: TEST_TAB_ICON,
        component: ({ tabId }) =>
          fixture === TEST_TAB_FIXTURES.sortable ? (
            <TestSortable tabId={tabId} />
          ) : (
            <TestTabBody tabId={tabId} titleKey={titleKey} />
          ),
      })
    },
    rightTabIds: () => host.registries.store.getState().tabs.map((t) => t.id),
    execute: (id, args) => host.commands.execute(id, args),
  }
  ;(window as unknown as PragmaTestWindow).__pragmaTest = api
}
