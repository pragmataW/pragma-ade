import { realpathSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import type { ProjectsService, Worktree } from '@pragma/module-projects/contract'
import { CLI_ERROR, type CliCallerContext } from '../contract'
import { CliError } from './cli-error'

const NO_WORKTREE = 'No worktree given and none could be inferred; pass --worktree <id>.'
const NO_PROJECT = 'No project given and none could be inferred; pass --project <id>.'

const real = (p: string): string => {
  try {
    return realpathSync(p)
  } catch {
    return resolve(p)
  }
}
const contains = (dir: string, path: string): boolean => path === dir || path.startsWith(`${dir}${sep}`)

async function allWorktrees(projects: ProjectsService): Promise<Worktree[]> {
  const lists = await Promise.all((await projects.listProjects()).map((p) => projects.listWorktrees(p.id)))
  return lists.flat().filter((w) => w.archivedAt === null)
}

/** The known worktree whose path is the longest prefix of `cwd` (both realpath'd). */
async function worktreeOfCwd(projects: ProjectsService, cwd: string): Promise<Worktree | null> {
  const target = real(cwd)
  let best: { w: Worktree; len: number } | null = null
  for (const w of await allWorktrees(projects)) {
    const dir = real(w.path)
    if (contains(dir, target) && dir.length > (best?.len ?? -1)) best = { w, len: dir.length }
  }
  return best?.w ?? null
}

async function byId(projects: ProjectsService, id: string): Promise<Worktree> {
  const w = await projects.getWorktree(id)
  if (!w) throw new CliError(CLI_ERROR.not_found, `Worktree '${id}' not found.`)
  return w
}

/** `--worktree` → `PRAGMA_WORKTREE_ID` → the worktree containing the cwd → the active worktree. */
export async function resolveWorktree(
  projects: ProjectsService,
  explicitId: string | undefined,
  ctx: CliCallerContext,
): Promise<Worktree> {
  const id = explicitId ?? ctx.worktreeId
  if (id) return byId(projects, id)
  const fromCwd = await worktreeOfCwd(projects, ctx.cwd)
  if (fromCwd) return fromCwd
  const active = projects.getActiveWorktreeId()
  if (active) return byId(projects, active)
  throw new CliError(CLI_ERROR.invalid_argument, NO_WORKTREE)
}

/** `--project` → the project of the resolved worktree. */
export async function resolveProjectId(
  projects: ProjectsService,
  explicitId: string | undefined,
  ctx: CliCallerContext,
): Promise<string> {
  if (explicitId) {
    if (!(await projects.getProject(explicitId)))
      throw new CliError(CLI_ERROR.not_found, `Project '${explicitId}' not found.`)
    return explicitId
  }
  try {
    return (await resolveWorktree(projects, undefined, ctx)).projectId
  } catch (e) {
    if (e instanceof CliError && e.code === CLI_ERROR.invalid_argument) throw new CliError(e.code, NO_PROJECT)
    throw e
  }
}
