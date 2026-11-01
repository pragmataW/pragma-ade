import { ShellSlots } from '@pragma/sdk'
import { defineRendererModule, type RendererContext } from '@pragma/sdk/renderer'
import {
  BADGE_ORDER_CHANGED_FILES,
  BREADCRUMB_ORDER,
  FOCUS_EVENT,
  SIDEBAR_ORDER,
  SLOT_ENTRY_IDS,
  STATUSBAR_ORDER_BRANCH,
} from '../constants'
import {
  PROJECTS_SLOTS,
  ProjectsRendererServiceToken,
  type ProjectsSettings,
  projectsIpc,
  type WorktreeRowSlotProps,
} from '../contract'
import { Breadcrumb } from './components/Breadcrumb'
import { ChangedFilesBadge } from './components/ChangedFilesBadge'
import { ProjectsSidebar } from './components/ProjectsSidebar'
import { StatusBarBranch } from './components/StatusBarBranch'
import { sidebarAction } from './lib/actions'
import { type ProjectsRuntime, withRuntime } from './lib/runtime'
import { createProjectsRendererService } from './renderer-service'
import { createProjectsStore, selectActiveWorktree } from './store'
import { createUiStore } from './ui-store'

function registerSlots(ctx: RendererContext<ProjectsSettings>, runtime: ProjectsRuntime): void {
  ctx.slots.register(ShellSlots.sidebarMain, {
    id: SLOT_ENTRY_IDS.sidebar,
    order: SIDEBAR_ORDER,
    component: withRuntime(runtime, ProjectsSidebar),
  })
  ctx.slots.register(ShellSlots.titlebarLeft, {
    id: SLOT_ENTRY_IDS.breadcrumb,
    order: BREADCRUMB_ORDER,
    component: withRuntime(runtime, Breadcrumb),
  })
  ctx.slots.register(ShellSlots.statusbarLeft, {
    id: SLOT_ENTRY_IDS.branch,
    order: STATUSBAR_ORDER_BRANCH,
    component: withRuntime(runtime, StatusBarBranch),
  })
  ctx.slots.register<WorktreeRowSlotProps>(PROJECTS_SLOTS.worktreeRowBadges, {
    id: SLOT_ENTRY_IDS.changedFiles,
    order: BADGE_ORDER_CHANGED_FILES,
    component: withRuntime(runtime, ChangedFilesBadge),
  })
}

export default defineRendererModule<ProjectsSettings>({
  activate(ctx) {
    const { store, start } = createProjectsStore(ctx.ipc)
    const runtime: ProjectsRuntime = { store, ui: createUiStore(), ipc: ctx.ipc }
    ctx.services.provide(ProjectsRendererServiceToken, createProjectsRendererService(store, ctx.ipc))
    registerSlots(ctx, runtime)
    start().catch((error: unknown) => console.warn('projects: initial state failed', error))
    // Changes made outside the app (worktree add/remove, checkout) show up when the window gets focus again.
    window.addEventListener(FOCUS_EVENT, () => {
      const active = selectActiveWorktree(store.getState())
      if (active) void sidebarAction(runtime, projectsIpc.syncProject, { projectId: active.projectId })
    })
  },
})
