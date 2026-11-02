import { mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'
import type { GitService } from '@pragma/module-projects/contract'
import { asc, count, desc, eq, inArray, isNotNull, lt, type PragmaDb } from '@pragma/sdk/db'
import { writeFileAtomic } from '@pragma/sdk/main'
import { DAY_MS, GIT, MB, UTF8 } from '../constants'
import {
  type EntryDetail,
  type EntrySummary,
  FILE_STATE,
  type HistoryReason,
  type LocalHistoryService,
  type LocalHistorySettings,
  type RecordInput,
  type RestoreResult,
  type StashRef,
} from '../contract'
import type { BlobStore } from './blobs'
import { entries, files, stashes } from './schema'

const RESTORE_REASON: HistoryReason = 'restore'
type EntryRow = typeof entries.$inferSelect

export class RestoreFailedError extends Error {
  readonly reason: 'headMoved' | 'gitUnavailable' | 'gitFailed'
  constructor(reason: RestoreFailedError['reason'], detail?: string) {
    super(detail ?? reason)
    this.reason = reason
  }
}

/** `path` resolved under `cwd`, or null when it would escape it (a stored path is never trusted blindly). */
function inside(cwd: string, path: string): string | null {
  const root = resolve(cwd)
  const full = resolve(root, path)
  return full.startsWith(root + sep) ? full : null
}

export interface StoreDeps {
  db: PragmaDb
  blobs: BlobStore
  settings(): LocalHistorySettings
  git(): Pick<GitService, 'run'> | undefined
  onChanged(): void
}

export function createHistoryStore(d: StoreDeps): LocalHistoryService {
  const { db, blobs } = d

  const summarize = (e: EntryRow): EntrySummary => ({
    id: e.id,
    worktreeId: e.worktreeId,
    cwd: e.cwd,
    reason: e.reason as HistoryReason,
    createdAt: e.createdAt,
    restoredAt: e.restoredAt,
    headSha: e.headSha,
    fileCount: db.select({ n: count() }).from(files).where(eq(files.entryId, e.id)).get()?.n ?? 0,
    stashCount: db.select({ n: count() }).from(stashes).where(eq(stashes.entryId, e.id)).get()?.n ?? 0,
  })

  const entry = (id: number): EntryRow | undefined => db.select().from(entries).where(eq(entries.id, id)).get()

  const removeEntries = (ids: number[]): void => {
    if (ids.length === 0) return
    db.delete(files).where(inArray(files.entryId, ids)).run()
    db.delete(stashes).where(inArray(stashes.entryId, ids)).run()
    db.delete(entries).where(inArray(entries.id, ids)).run()
  }

  const sweepBlobs = (): void => {
    const keep = db.selectDistinct({ blob: files.blob }).from(files).where(isNotNull(files.blob)).all()
    blobs.sweep(new Set(keep.map((r) => r.blob as string)))
  }

  /** Bytes of distinct saved content (what the blob directory holds). */
  const totalBytes = (): number => {
    const rows = db
      .selectDistinct({ blob: files.blob, size: files.size })
      .from(files)
      .where(isNotNull(files.blob))
      .all()
    return rows.reduce((sum, r) => sum + r.size, 0)
  }

  const prune = (): number => {
    const { retentionDays, maxTotalMb } = d.settings()
    const cutoff = Date.now() - retentionDays * DAY_MS
    const expired = db.select({ id: entries.id }).from(entries).where(lt(entries.createdAt, cutoff)).all()
    removeEntries(expired.map((r) => r.id))
    let removed = expired.length
    const oldestFirst = db.select({ id: entries.id }).from(entries).orderBy(asc(entries.createdAt)).all()
    for (const { id } of oldestFirst) {
      if (totalBytes() <= maxTotalMb * MB) break
      removeEntries([id])
      removed++
    }
    sweepBlobs()
    return removed
  }

  const record = async (input: RecordInput): Promise<EntrySummary | null> => {
    const paths = [...new Set(input.paths)]
    if (paths.length === 0 && input.stashes.length === 0 && !input.headSha) return null
    const captured = paths.flatMap((path) => {
      const full = inside(input.cwd, path)
      return full ? [{ path, ...blobs.capture(full) }] : []
    })
    const row = db
      .insert(entries)
      .values({
        worktreeId: input.worktreeId,
        cwd: input.cwd,
        reason: input.reason,
        createdAt: Date.now(),
        headSha: input.headSha,
      })
      .returning()
      .get()
    for (const c of captured)
      db.insert(files)
        .values({ entryId: row.id, ...c })
        .run()
    for (const s of input.stashes)
      db.insert(stashes)
        .values({ entryId: row.id, ...s })
        .onConflictDoNothing()
        .run()
    prune()
    d.onChanged()
    return entry(row.id) ? summarize(row) : null
  }

  const detail = (id: number): EntryDetail | null => {
    const e = entry(id)
    if (!e) return null
    return {
      ...summarize(e),
      files: db
        .select({ path: files.path, state: files.state, size: files.size })
        .from(files)
        .where(eq(files.entryId, id))
        .orderBy(asc(files.path))
        .all() as EntryDetail['files'],
      stashes: db
        .select({ sha: stashes.sha, message: stashes.message })
        .from(stashes)
        .where(eq(stashes.entryId, id))
        .all(),
    }
  }

  /** Writes one saved file back (or deletes it when it did not exist); false when it cannot be restored. */
  const restoreOne = (cwd: string, r: typeof files.$inferSelect): boolean => {
    const full = inside(cwd, r.path)
    if (!full) return false
    if (r.state === FILE_STATE.missing) {
      rmSync(full, { force: true })
      return true
    }
    const bytes = r.state === FILE_STATE.saved && r.blob ? blobs.read(r.blob) : null
    if (!bytes) return false
    mkdirSync(dirname(full), { recursive: true })
    writeFileAtomic(full, bytes)
    return true
  }

  /** Restores the entry's files (or only `only`); binary and too-large ones are skipped. */
  const restoreFiles = (e: EntryRow, only?: string[]): { restored: string[]; skipped: string[] } => {
    const rows = db.select().from(files).where(eq(files.entryId, e.id)).all()
    const chosen = only ? rows.filter((r) => only.includes(r.path)) : rows
    const out = { restored: [] as string[], skipped: [] as string[] }
    for (const r of chosen) (restoreOne(e.cwd, r) ? out.restored : out.skipped).push(r.path)
    return out
  }

  const runGit = async (cwd: string, args: string[]): Promise<string> => {
    const git = d.git()
    if (!git) throw new RestoreFailedError('gitUnavailable')
    const r = await git.run(cwd, args, { allowFailure: true })
    if (r.exitCode !== 0) throw new RestoreFailedError('gitFailed', r.stderr.trim())
    return r.stdout.trim()
  }

  /** Puts dropped stashes back on the stash list (their commits outlive the drop until git gc). */
  const restoreStashes = async (e: EntryRow, list: StashRef[]): Promise<void> => {
    for (const s of list) await runGit(e.cwd, [...GIT.stashStore, s.message, s.sha])
  }

  /** Redoes an undone commit, only while HEAD is still the commit's parent (nothing moved since). */
  const restoreHead = async (e: EntryRow, sha: string): Promise<void> => {
    const head = await runGit(e.cwd, [...GIT.revParse, GIT.head])
    const parent = await runGit(e.cwd, [...GIT.revParse, `${sha}${GIT.parentSuffix}`])
    if (head !== parent) throw new RestoreFailedError('headMoved')
    await runGit(e.cwd, [...GIT.resetSoft, sha])
  }

  /** Saves what a restore is about to overwrite, so the restore can be undone too. */
  const saveBeforeRestore = async (e: EntryRow, only?: string[]): Promise<void> => {
    const known = db
      .select({ path: files.path })
      .from(files)
      .where(eq(files.entryId, e.id))
      .all()
      .map((r) => r.path)
    const paths = only ? known.filter((p) => only.includes(p)) : known
    if (paths.length === 0) return
    await record({ worktreeId: e.worktreeId, cwd: e.cwd, reason: RESTORE_REASON, paths, stashes: [], headSha: null })
  }

  /** Files, then (for a whole entry) dropped stashes and an undone commit. */
  const restoreAll = async (e: EntryRow, only?: string[]): Promise<RestoreResult> => {
    const out = restoreFiles(e, only)
    if (!only) {
      await restoreStashes(e, detail(e.id)?.stashes ?? [])
      if (e.headSha) await restoreHead(e, e.headSha)
    }
    db.update(entries).set({ restoredAt: Date.now() }).where(eq(entries.id, e.id)).run()
    return { ok: true, ...out }
  }

  const restore = async (id: number, only?: string[]): Promise<RestoreResult> => {
    const e = entry(id)
    if (!e) return { ok: false, reason: 'notFound' }
    await saveBeforeRestore(e, only)
    try {
      return await restoreAll(e, only)
    } catch (error) {
      if (error instanceof RestoreFailedError) return { ok: false, reason: error.reason, detail: error.message }
      throw error
    } finally {
      d.onChanged()
    }
  }

  return {
    record,
    list: () => db.select().from(entries).orderBy(desc(entries.createdAt), desc(entries.id)).all().map(summarize),
    detail,
    fileContent(id, path) {
      const row = db
        .select()
        .from(files)
        .where(eq(files.entryId, id))
        .all()
        .find((r) => r.path === path)
      if (!row) return null
      const bytes = row.blob ? blobs.read(row.blob) : null
      return { state: row.state as EntryDetail['files'][number]['state'], saved: bytes ? bytes.toString(UTF8) : null }
    },
    restore,
    remove(id) {
      removeEntries([id])
      sweepBlobs()
      d.onChanged()
    },
    clear() {
      removeEntries(
        db
          .select({ id: entries.id })
          .from(entries)
          .all()
          .map((r) => r.id),
      )
      sweepBlobs()
      d.onChanged()
    },
    prune,
  }
}
