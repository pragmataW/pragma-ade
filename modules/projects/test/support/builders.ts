import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { applyMigrations, openDatabase } from '@pragma/sdk/runtime/main'
import { createTempUserData } from '@pragma/test-support'
import type { Project, Worktree } from '../../src/contract'
import { ProjectsRepo } from '../../src/main/repo'

export const MODULE_DIR = join(import.meta.dirname, '..', '..')
const MIGRATIONS_DIR = join(MODULE_DIR, 'migrations')

let seq = 0
const nextId = (prefix: string): string => `${prefix}-${++seq}`

export function aProject(over: Partial<Omit<Project, 'sortOrder'>> = {}): Omit<Project, 'sortOrder'> {
  const id = over.id ?? nextId('p')
  return { id, name: id, repoPath: `/repos/${id}`, defaultBaseBranch: 'main', createdAt: seq, ...over }
}

export function aWorktree(projectId: string, over: Partial<Worktree> = {}): Worktree {
  const id = over.id ?? nextId('w')
  return {
    id,
    projectId,
    path: `/wt/${id}`,
    branch: id,
    baseBranch: 'main',
    isMain: false,
    createdAt: seq,
    archivedAt: null,
    ...over,
  }
}

/** A temp SQLite file with this module's migrations applied (the same runner the host uses). */
export function makeTestDb() {
  const temp = createTempUserData()
  const opened = openDatabase(join(temp.path, 'test.db'))
  const migrations = readdirSync(MIGRATIONS_DIR).map((name) => ({
    name,
    sql: readFileSync(join(MIGRATIONS_DIR, name), 'utf8'),
  }))
  const result = applyMigrations(opened.sqlite, [{ module: 'projects', migrations }])
  if (result.failed) throw result.failed.error
  return {
    ...opened,
    repo: new ProjectsRepo(opened.db),
    cleanup() {
      opened.close()
      temp.cleanup()
    },
  }
}
