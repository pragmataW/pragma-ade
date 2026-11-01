import { and, asc, desc, eq, isNull, type PragmaDb, sql } from '@pragma/sdk/db'
import type { Project, Worktree } from '../contract'
import { projectsProjects as P, projectsState as S, projectsWorktrees as W } from './schema'

type ProjectRow = typeof P.$inferSelect
export type StoredProject = Project & { archivedAt: number | null }

const toProject = ({ archivedAt: _archived, ...p }: ProjectRow): Project => p
const ROWID = sql`${W}.rowid`
const WORKTREE_ORDER = [desc(W.isMain), asc(W.createdAt), asc(ROWID)]

/** Synchronous data access for the projects tables; returns contract DTOs, never drizzle rows. */
export class ProjectsRepo {
  readonly #db: PragmaDb
  constructor(db: PragmaDb) {
    this.#db = db
  }

  #nextSortOrder(): number {
    const row = this.#db
      .select({ m: sql<number | null>`max(${P.sortOrder})` })
      .from(P)
      .get()
    return (row?.m ?? -1) + 1
  }

  listProjects(): Project[] {
    return this.#db.select().from(P).where(isNull(P.archivedAt)).orderBy(asc(P.sortOrder)).all().map(toProject)
  }

  getProject(id: string): Project | null {
    const row = this.#db
      .select()
      .from(P)
      .where(and(eq(P.id, id), isNull(P.archivedAt)))
      .get()
    return row ? toProject(row) : null
  }

  findProjectByPath(repoPath: string): StoredProject | null {
    const row = this.#db.select().from(P).where(eq(P.repoPath, repoPath)).get()
    return row ? { ...toProject(row), archivedAt: row.archivedAt } : null
  }

  insertProject(p: Omit<Project, 'sortOrder'>): Project {
    const row = { ...p, sortOrder: this.#nextSortOrder(), archivedAt: null }
    this.#db.insert(P).values(row).run()
    return toProject(row)
  }

  unarchiveProject(id: string): void {
    this.#db.update(P).set({ archivedAt: null, sortOrder: this.#nextSortOrder() }).where(eq(P.id, id)).run()
  }

  archiveProject(id: string, at: number): void {
    this.#db.update(P).set({ archivedAt: at }).where(eq(P.id, id)).run()
  }

  /** Listed ids first in the given order; the other live projects follow in their previous relative order. */
  setProjectOrder(ids: string[]): void {
    const rest = this.listProjects()
      .map((p) => p.id)
      .filter((id) => !ids.includes(id))
    this.#db.transaction((tx) => {
      ;[...ids, ...rest].forEach((id, i) => {
        tx.update(P).set({ sortOrder: i }).where(eq(P.id, id)).run()
      })
    })
  }

  listWorktrees(projectId: string): Worktree[] {
    return this.#db
      .select()
      .from(W)
      .where(and(eq(W.projectId, projectId), isNull(W.archivedAt)))
      .orderBy(...WORKTREE_ORDER)
      .all()
  }

  /** Live worktrees of live projects. */
  listAllLiveWorktrees(): Worktree[] {
    return this.#db
      .select({ w: W })
      .from(W)
      .innerJoin(P, eq(P.id, W.projectId))
      .where(and(isNull(W.archivedAt), isNull(P.archivedAt)))
      .orderBy(asc(P.sortOrder), ...WORKTREE_ORDER)
      .all()
      .map((r) => r.w)
  }

  getWorktree(id: string): Worktree | null {
    return this.#db.select().from(W).where(eq(W.id, id)).get() ?? null
  }

  insertWorktree(w: Worktree): void {
    this.#db.insert(W).values(w).run()
  }

  updateWorktreeBranch(id: string, branch: string | null): void {
    this.#db.update(W).set({ branch }).where(eq(W.id, id)).run()
  }

  updateWorktreeBaseBranch(id: string, baseBranch: string): void {
    this.#db.update(W).set({ baseBranch }).where(eq(W.id, id)).run()
  }

  archiveWorktree(id: string, at: number): void {
    this.#db.update(W).set({ archivedAt: at }).where(eq(W.id, id)).run()
  }

  getState(key: string): string | null {
    return this.#db.select().from(S).where(eq(S.key, key)).get()?.value ?? null
  }

  setState(key: string, value: string | null): void {
    this.#db.insert(S).values({ key, value }).onConflictDoUpdate({ target: S.key, set: { value } }).run()
  }
}
