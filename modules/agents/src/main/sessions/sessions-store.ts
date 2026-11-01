import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray, isNull, not, type PragmaDb, sql } from '@pragma/sdk/db'
import {
  type AgentSession,
  type AgentsErrorCode,
  isRunningStatus,
  SESSION_STATUS,
  type SessionPatch,
} from '../../contract'
import type { StoreDeps } from '../profiles/profiles-store'
import { type SessionRow, agentsSessions as T } from '../schema'

/** A stored session; the service adds the display `title` and `attachable`. */
export type SessionRecord = Omit<AgentSession, 'title' | 'attachable'> & { storedTitle: string | null }

export type StorePatch = SessionPatch & {
  errorCode?: AgentsErrorCode | null
  errorMessage?: string | null
  closedAt?: number | null
  lastFocusedAt?: number | null
}

export interface NewSessionRow {
  worktreeId: string
  profileId: string | null
  providerId: string
  mode: string
  title: string | null
}

const ENDED = [SESSION_STATUS.exited, SESSION_STATUS.error]
const notEnded = () => not(inArray(T.status, ENDED))

function toRecord(r: SessionRow): SessionRecord {
  const { title, errorCode, errorMessage, ...rest } = r
  return { ...rest, storedTitle: title, error: errorCode ? { code: errorCode, message: errorMessage ?? '' } : null }
}

/** Agent sessions (`agents_sessions`): ordinals per worktree, closing, focus, and the startup sweep. */
export class SessionsStore {
  readonly #db: PragmaDb
  readonly #now: () => number
  readonly #newId: () => string

  constructor(db: PragmaDb, deps: StoreDeps = {}) {
    this.#db = db
    this.#now = deps.now ?? Date.now
    this.#newId = deps.newId ?? randomUUID
  }

  insert(row: NewSessionRow): SessionRecord {
    const id = this.#newId()
    this.#db.transaction(() => {
      const last = this.#db
        .select({ value: sql<number | null>`max(${T.ordinal})` })
        .from(T)
        .where(eq(T.worktreeId, row.worktreeId))
        .get()
      this.#db
        .insert(T)
        .values({
          id,
          ...row,
          ordinal: (last?.value ?? 0) + 1,
          status: SESSION_STATUS.starting,
          createdAt: this.#now(),
        })
        .run()
    })
    return this.#must(id)
  }

  #must(id: string): SessionRecord {
    const r = this.get(id)
    if (!r) throw new Error(`agents: session ${id} vanished`)
    return r
  }

  get(id: string): SessionRecord | null {
    const r = this.#db.select().from(T).where(eq(T.id, id)).get()
    return r ? toRecord(r) : null
  }

  listByWorktree(worktreeId: string, opts: { includeClosed?: boolean } = {}): SessionRecord[] {
    const where = opts.includeClosed
      ? eq(T.worktreeId, worktreeId)
      : and(eq(T.worktreeId, worktreeId), isNull(T.closedAt))
    return this.#db.select().from(T).where(where).orderBy(asc(T.ordinal)).all().map(toRecord)
  }

  listOpen(worktreeId?: string): SessionRecord[] {
    const open = isNull(T.closedAt)
    const where = worktreeId ? and(open, eq(T.worktreeId, worktreeId)) : open
    return this.#db.select().from(T).where(where).orderBy(asc(T.createdAt), asc(T.ordinal)).all().map(toRecord)
  }

  update(id: string, patch: StorePatch): SessionRecord {
    const { title, ...rest } = patch
    const values = title === undefined ? rest : { ...rest, title }
    if (Object.keys(values).length > 0) this.#db.update(T).set(values).where(eq(T.id, id)).run()
    return this.#must(id)
  }

  /** Running and open: max `lastFocusedAt`, else the newest. */
  lastFocusedRunning(worktreeId: string): SessionRecord | null {
    const running = this.listOpen(worktreeId).filter((s) => isRunningStatus(s.status))
    const focused = running
      .filter((s) => s.lastFocusedAt !== null)
      .sort((a, b) => (b.lastFocusedAt ?? 0) - (a.lastFocusedAt ?? 0))
    return focused[0] ?? running.at(-1) ?? null
  }

  /** Startup: every row not exited/error becomes exited (no exit code); returns their ids. */
  sweepStale(): string[] {
    const stale = this.#db.select({ id: T.id }).from(T).where(notEnded()).all()
    if (stale.length === 0) return []
    this.#db
      .update(T)
      .set({ status: SESSION_STATUS.exited, endedAt: this.#now(), exitCode: null })
      .where(notEnded())
      .run()
    return stale.map((r) => r.id)
  }
}
