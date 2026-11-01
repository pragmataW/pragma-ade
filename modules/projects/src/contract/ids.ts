/** Every id other modules may reference (§4.4, §4.5, §10.3). Other contract files use these, never repeat strings. */
export const PROJECTS_MODULE_ID = 'projects'

/** Main-process bus events (binding names, §4.4 and §10.3). */
export const PROJECTS_EVENTS = {
  worktreeCreated: 'worktree.created',
  worktreeRemoved: 'worktree.removed',
  worktreeChanged: 'worktree.changed',
  worktreeSelected: 'worktree.selected',
  projectRemoved: 'project.removed',
} as const

export const PROJECTS_COMMANDS = {
  selectWorktree: 'projects.selectWorktree',
  addProject: 'projects.addProject',
  newWorktree: 'projects.newWorktree',
} as const

/** Slots hosted by the worktree row (shell slots come from the SDK `ShellSlots`). */
export const PROJECTS_SLOTS = {
  worktreeRowBadges: 'sidebar.worktreeRow.badges',
  worktreeRowLeading: 'sidebar.worktreeRow.leading',
  worktreeRowSubtitle: 'sidebar.worktreeRow.subtitle',
} as const

export const PROJECTS_CHANNELS = {
  getState: 'projects.getState',
  pickFolder: 'projects.pickFolder',
  addProject: 'projects.addProject',
  removeProject: 'projects.removeProject',
  reorderProjects: 'projects.reorderProjects',
  syncProject: 'projects.syncProject',
  listBranches: 'projects.listBranches',
  suggestWorktreePath: 'projects.suggestWorktreePath',
  createWorktree: 'projects.createWorktree',
  getRemovalInfo: 'projects.getRemovalInfo',
  removeWorktree: 'projects.removeWorktree',
  selectWorktree: 'projects.selectWorktree',
  setBaseBranch: 'projects.setBaseBranch',
  getSettings: 'projects.getSettings',
  updateSettings: 'projects.updateSettings',
  stateChanged: 'projects.stateChanged',
  statusChanged: 'projects.statusChanged',
  selected: 'projects.selected',
} as const

export const PROJECTS_SERVICE_IDS = {
  service: 'projects.service',
  git: 'projects.git',
  renderer: 'projects.renderer',
} as const
