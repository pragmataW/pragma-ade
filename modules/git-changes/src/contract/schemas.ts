import { z } from '@pragma/sdk'
import { MAX_FILE_BYTES_DEFAULT } from '../constants'

export const CHANGE_MODES = ['uncommitted', 'branch'] as const
export const ChangeModeSchema = z.enum(CHANGE_MODES)
export type ChangeMode = z.infer<typeof ChangeModeSchema>
export const CHANGE_MODE = { uncommitted: 'uncommitted', branch: 'branch' } as const satisfies Record<
  string,
  ChangeMode
>

/** `U` = untracked. */
export const FILE_STATUSES = ['A', 'M', 'D', 'R', 'U'] as const
export const FileStatusSchema = z.enum(FILE_STATUSES)
export type FileStatus = z.infer<typeof FileStatusSchema>
export const FILE_STATUS = { A: 'A', M: 'M', D: 'D', R: 'R', U: 'U' } as const satisfies Record<string, FileStatus>

const ABSOLUTE_RE = /^(?:\/|[A-Za-z]:)/
const FORBIDDEN_CHAR_RE = /[\0\\]/
const PARENT_SEGMENT = '..'
const SEPARATOR = '/'

/** A worktree-relative path: never absolute, no `..` segment, no NUL, no backslash. */
export const RepoPathSchema = z
  .string()
  .min(1)
  .refine((p) => !ABSOLUTE_RE.test(p), { message: 'absolute path' })
  .refine((p) => !FORBIDDEN_CHAR_RE.test(p), { message: 'forbidden character' })
  .refine((p) => !p.split(SEPARATOR).includes(PARENT_SEGMENT), { message: 'parent segment' })
export type RepoPath = z.infer<typeof RepoPathSchema>

const count = z.number().int().nonnegative()

export const ChangedFileSchema = z.object({
  path: RepoPathSchema,
  oldPath: RepoPathSchema.optional(),
  status: FileStatusSchema,
  additions: count,
  deletions: count,
  binary: z.boolean(),
})
export type ChangedFile = z.infer<typeof ChangedFileSchema>

export const CHANGE_LIST_STATES = ['ok', 'baseNotFound', 'noMergeBase'] as const
export type ChangeListState = (typeof CHANGE_LIST_STATES)[number]
export const CHANGE_LIST_STATE = {
  ok: 'ok',
  baseNotFound: 'baseNotFound',
  noMergeBase: 'noMergeBase',
} as const satisfies Record<string, ChangeListState>

const listHeader = { worktreeId: z.string().min(1), mode: ChangeModeSchema, baseBranch: z.string() }
export const TotalsSchema = z.object({ files: count, additions: count, deletions: count })
export type Totals = z.infer<typeof TotalsSchema>

export const ChangeListSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.literal(CHANGE_LIST_STATE.ok),
    ...listHeader,
    mergeBase: z.string().nullable(),
    headSha: z.string().nullable(),
    commitCount: count.nullable(),
    files: z.array(ChangedFileSchema),
    totals: TotalsSchema,
  }),
  z.object({ state: z.literal(CHANGE_LIST_STATE.baseNotFound), ...listHeader }),
  z.object({ state: z.literal(CHANGE_LIST_STATE.noMergeBase), ...listHeader }),
])
export type ChangeList = z.infer<typeof ChangeListSchema>
export type OkChangeList = Extract<ChangeList, { state: 'ok' }>

export const FILE_VERSION_KINDS = ['text', 'binary', 'tooLarge', 'absent', 'unreadable'] as const
export type FileVersionKind = (typeof FILE_VERSION_KINDS)[number]
export const FILE_VERSION_KIND = {
  text: 'text',
  binary: 'binary',
  tooLarge: 'tooLarge',
  absent: 'absent',
  unreadable: 'unreadable',
} as const satisfies Record<string, FileVersionKind>

export const FileVersionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal(FILE_VERSION_KIND.text), contents: z.string() }),
  z.object({ kind: z.literal(FILE_VERSION_KIND.binary) }),
  z.object({ kind: z.literal(FILE_VERSION_KIND.tooLarge), bytes: count }),
  z.object({ kind: z.literal(FILE_VERSION_KIND.absent) }),
  z.object({ kind: z.literal(FILE_VERSION_KIND.unreadable) }),
])
export type FileVersion = z.infer<typeof FileVersionSchema>

export const FileDiffContentsSchema = z.object({
  path: RepoPathSchema,
  oldPath: RepoPathSchema.optional(),
  status: FileStatusSchema,
  old: FileVersionSchema,
  new: FileVersionSchema,
})
export type FileDiffContents = z.infer<typeof FileDiffContentsSchema>

export const VIEW_MODES = ['tree', 'list'] as const
export type ViewMode = (typeof VIEW_MODES)[number]
export const DIFF_STYLES = ['unified', 'split'] as const
export type DiffStyle = (typeof DIFF_STYLES)[number]

export const GitChangesSettingsSchema = z.object({
  maxFileBytes: z.number().int().positive(),
  viewMode: z.enum(VIEW_MODES),
  diffStyle: z.enum(DIFF_STYLES),
  showFullFile: z.boolean(),
})
export type GitChangesSettings = z.infer<typeof GitChangesSettingsSchema>
export const GIT_CHANGES_SETTINGS_DEFAULTS: GitChangesSettings = {
  maxFileBytes: MAX_FILE_BYTES_DEFAULT,
  viewMode: VIEW_MODES[0],
  diffStyle: DIFF_STYLES[0],
  showFullFile: false,
}

export const GIT_CHANGES_ERROR_CODES = ['worktreeNotFound'] as const
export type GitChangesErrorCode = (typeof GIT_CHANGES_ERROR_CODES)[number]
