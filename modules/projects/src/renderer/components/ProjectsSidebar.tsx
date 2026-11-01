import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { Icon } from '@pragma/ui/components/icon'
import { DRAG_ACTIVATION_PX, GHOST_VARIANT, ICON_PX, ICONS } from '../../constants'
import { type Project, projectsIpc, PROJECTS_TESTIDS as T } from '../../contract'
import { addProjectFlow, sidebarAction } from '../lib/actions'
import { useProjects, useRuntime } from '../lib/runtime'
import { ProjectGroup } from './ProjectGroup'
import { SidebarError } from './SidebarError'

/** Projects in their stored order; dropping one persists the new order. */
function SortableProjects({ projects }: { projects: Project[] }) {
  const runtime = useRuntime()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_PX } }))
  const ids = projects.map((p) => p.id)
  const reorder = ({ active, over }: DragEndEvent) => {
    const from = ids.indexOf(String(active.id))
    const to = over ? ids.indexOf(String(over.id)) : -1
    if (to < 0 || from === to) return
    void sidebarAction(runtime, projectsIpc.reorderProjects, { projectIds: arrayMove(ids, from, to) })
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorder}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {projects.map((p) => (
          <ProjectGroup key={p.id} project={p} />
        ))}
      </SortableContext>
    </DndContext>
  )
}

/** `sidebar.main`: the PROJECTS section (ui-notes: section label, add button, project tree). */
export function ProjectsSidebar() {
  const t = useT()
  const runtime = useRuntime()
  const projects = useProjects((s) => s.projects)
  const hydrated = useProjects((s) => s.hydrated)
  const addLabel = t('projects:sidebar.addProject')
  return (
    <section data-testid={T.sidebar} className="flex flex-col gap-0.5 px-1.5 py-2">
      <header className="flex h-7 items-center justify-between pl-1.5">
        <h2 className="font-semibold text-[11px] text-mu uppercase tracking-[0.06em]">{t('projects:sidebar.title')}</h2>
        <Button
          variant={GHOST_VARIANT}
          size="icon-sm"
          data-testid={T.add}
          aria-label={addLabel}
          title={addLabel}
          onClick={() => void addProjectFlow(runtime)}
        >
          <Icon name={ICONS.add} size={ICON_PX.row} />
        </Button>
      </header>
      <SidebarError />
      {hydrated && projects.length === 0 && (
        <p data-testid={T.empty} className="px-1.5 py-2 text-mu text-[12px]">
          {t('projects:sidebar.empty')}
        </p>
      )}
      <SortableProjects projects={projects} />
    </section>
  )
}
