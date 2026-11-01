import type { ProjectsService } from '@pragma/module-projects/contract'
import type { PtyService } from '@pragma/module-terminal/contract'

/** The parts of 02's `PtyService` this module uses. */
export type PtyAccess = Pick<PtyService, 'spawn' | 'kill' | 'onExit' | 'onData' | 'getShellEnv'>
/** The parts of 01's `ProjectsService` this module uses. */
export type ProjectsAccess = Pick<ProjectsService, 'getWorktree' | 'createWorktree' | 'getProject'>
