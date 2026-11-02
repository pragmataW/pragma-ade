import { DESTRUCTIVE_REASONS } from '@pragma/module-git-changes/contract'
import { z } from '@pragma/sdk'
import { RETENTION } from '../constants'

/** Why an entry exists: a Git Changes destructive operation, or a restore (which is itself undoable). */
export const HISTORY_REASONS = [...DESTRUCTIVE_REASONS, 'restore'] as const
export type HistoryReason = (typeof HISTORY_REASONS)[number]

/** `saved`: content kept; `missing`: the file did not exist (restoring deletes it); else listed only. */
export const FILE_STATES = ['saved', 'missing', 'binary', 'tooLarge'] as const
export type FileState = (typeof FILE_STATES)[number]
export const FILE_STATE = {
  saved: 'saved',
  missing: 'missing',
  binary: 'binary',
  tooLarge: 'tooLarge',
} as const satisfies Record<string, FileState>

export const LocalHistorySettingsSchema = z.object({
  retentionDays: z
    .number()
    .int()
    .min(RETENTION.minDays)
    .max(RETENTION.maxDays)
    .default(RETENTION.defaultDays)
    .catch(RETENTION.defaultDays),
  maxTotalMb: z
    .number()
    .int()
    .min(RETENTION.minMb)
    .max(RETENTION.maxMb)
    .default(RETENTION.defaultMb)
    .catch(RETENTION.defaultMb),
})
export type LocalHistorySettings = z.infer<typeof LocalHistorySettingsSchema>

export const StashRefSchema = z.object({ sha: z.string(), message: z.string() })
export type StashRef = z.infer<typeof StashRefSchema>

/** What to save: the files at `paths` under `cwd` as they are now, plus stashes / a HEAD about to be lost. */
export const RecordInputSchema = z.object({
  worktreeId: z.string(),
  cwd: z.string(),
  reason: z.enum(HISTORY_REASONS),
  paths: z.array(z.string()),
  stashes: z.array(StashRefSchema),
  headSha: z.string().nullable(),
})
export type RecordInput = z.infer<typeof RecordInputSchema>

export const EntrySummarySchema = z.object({
  id: z.number(),
  worktreeId: z.string(),
  cwd: z.string(),
  reason: z.enum(HISTORY_REASONS),
  createdAt: z.number(),
  restoredAt: z.number().nullable(),
  headSha: z.string().nullable(),
  fileCount: z.number(),
  stashCount: z.number(),
})
export type EntrySummary = z.infer<typeof EntrySummarySchema>

export const EntryFileSchema = z.object({ path: z.string(), state: z.enum(FILE_STATES), size: z.number() })
export type EntryFile = z.infer<typeof EntryFileSchema>

export const EntryDetailSchema = EntrySummarySchema.extend({
  files: z.array(EntryFileSchema),
  stashes: z.array(StashRefSchema),
})
export type EntryDetail = z.infer<typeof EntryDetailSchema>

export const FileContentSchema = z.object({ state: z.enum(FILE_STATES), saved: z.string().nullable() })
export type FileContent = z.infer<typeof FileContentSchema>

export const RESTORE_FAILURES = ['notFound', 'headMoved', 'gitUnavailable', 'gitFailed'] as const
export type RestoreFailure = (typeof RESTORE_FAILURES)[number]
export const RestoreResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), restored: z.array(z.string()), skipped: z.array(z.string()) }),
  z.object({ ok: z.literal(false), reason: z.enum(RESTORE_FAILURES), detail: z.string().optional() }),
])
export type RestoreResult = z.infer<typeof RestoreResultSchema>

export const IdSchema = z.object({ id: z.number() })
export const RestoreInputSchema = z.object({ id: z.number(), paths: z.array(z.string()).optional() })
export const FileRefSchema = z.object({ id: z.number(), path: z.string() })
