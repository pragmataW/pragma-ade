import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { Icon } from '@pragma/ui/components/icon'
import { Input } from '@pragma/ui/components/input'
import { type ReactNode, useState } from 'react'
import { DRAG_ACTIVATION_PX, FILTER_CLEAR_KEY, GHOST_VARIANT, ICON_PX, ICONS } from '../../constants'
import { type Project, projectsIpc, PROJECTS_TESTIDS as T } from '../../contract'
import { addProjectFlow, sidebarAction } from '../lib/actions'
import { useProjects, useRuntime } from '../lib/runtime'
import { filterWorktrees, selectWorktreesOf } from '../store'
import { CreateWorktreeDialog } from './CreateWorktreeDialog'
import { ProjectGroup } from './ProjectGroup'
import { RemoveWorktreeDialog } from './RemoveWorktreeDialog'
import { SidebarError } from './SidebarError'

/** Projects in their stored order; dropping one persists the new order. */
function SortableProjects({ projects, query }: { projects: Project[]; query: string }) {
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
          <ProjectGroup key={p.id} project={p} query={query} />
        ))}
      </SortableContext>
    </DndContext>
  )
}

function HeaderButton(props: { testId: string; label: string; icon: string; pressed?: boolean; onClick(): void }) {
  return (
    <Button
      variant={GHOST_VARIANT}
      size="icon-sm"
      data-testid={props.testId}
      aria-label={props.label}
      aria-pressed={props.pressed}
      title={props.label}
      onClick={props.onClick}
    >
      <Icon name={props.icon} size={ICON_PX.row} />
    </Button>
  )
}

function FilterInput({ query, onChange, onClose }: { query: string; onChange(q: string): void; onClose(): void }) {
  const t = useT()
  return (
    <Input
      data-testid={T.filterInput}
      aria-label={t('projects:sidebar.filter')}
      placeholder={t('projects:sidebar.filterPlaceholder')}
      autoFocus
      value={query}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === FILTER_CLEAR_KEY) onClose()
      }}
      className="h-7 text-[12px]"
    />
  )
}

function SidebarMessage({ testId, children }: { testId: string; children: ReactNode }) {
  return (
    <p data-testid={testId} className="px-1.5 py-2 text-mu text-[12px]">
      {children}
    </p>
  )
}

/** `sidebar.main`: the PROJECTS section (ui-notes: section label, filter and add buttons, project tree). */
export function ProjectsSidebar() {
  const t = useT()
  const runtime = useRuntime()
  const projects = useProjects((s) => s.projects)
  const hydrated = useProjects((s) => s.hydrated)
  const [filterOpen, setFilterOpen] = useState(false)
  const [query, setQuery] = useState('')
  const noMatches = useProjects(
    (s) =>
      query.trim() !== '' &&
      s.projects.every((p) => filterWorktrees(p, selectWorktreesOf(s, p.id), query).length === 0),
  )
  const closeFilter = () => {
    setFilterOpen(false)
    setQuery('')
  }
  return (
    <section data-testid={T.sidebar} className="flex flex-col gap-0.5 px-1.5 py-2">
      <header className="flex h-7 items-center justify-between pl-1.5">
        <h2 className="font-semibold text-[11px] text-mu uppercase tracking-[0.06em]">{t('projects:sidebar.title')}</h2>
        <span className="flex items-center">
          <HeaderButton
            testId={T.filterToggle}
            label={t('projects:sidebar.filter')}
            icon={ICONS.filter}
            pressed={filterOpen}
            onClick={() => (filterOpen ? closeFilter() : setFilterOpen(true))}
          />
          <HeaderButton
            testId={T.add}
            label={t('projects:sidebar.addProject')}
            icon={ICONS.add}
            onClick={() => void addProjectFlow(runtime)}
          />
        </span>
      </header>
      {filterOpen && <FilterInput query={query} onChange={setQuery} onClose={closeFilter} />}
      <SidebarError />
      {hydrated && projects.length === 0 && (
        <SidebarMessage testId={T.empty}>{t('projects:sidebar.empty')}</SidebarMessage>
      )}
      {noMatches && <SidebarMessage testId={T.noMatches}>{t('projects:sidebar.noMatches')}</SidebarMessage>}
      <SortableProjects projects={projects} query={query} />
      <CreateWorktreeDialog />
      <RemoveWorktreeDialog />
    </section>
  )
}
