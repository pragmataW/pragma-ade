import { createServiceToken, type Disposable, defineIpc, z } from '@pragma/sdk'
import { ChangedFileSchema, RepoPathSchema, ShaSchema } from './schemas'

/** Source Control (VS Code parity) channels: renderer → main, each answering an `ScmResult` or data. */
export const GIT_SCM_CHANNELS = {
  state: 'git-changes.scm.state',
  hunks: 'git-changes.scm.hunks',
  stage: 'git-changes.scm.stage',
  unstage: 'git-changes.scm.unstage',
  discard: 'git-changes.scm.discard',
  applyHunk: 'git-changes.scm.applyHunk',
  commit: 'git-changes.scm.commit',
  undoCommit: 'git-changes.scm.undoCommit',
  stashList: 'git-changes.scm.stashList',
  stashPush: 'git-changes.scm.stashPush',
  stash: 'git-changes.scm.stash',
  stashClear: 'git-changes.scm.stashClear',
  stashFiles: 'git-changes.scm.stashFiles',
  remote: 'git-changes.scm.remote',
} as const

const count = z.number().int().nonnegative()
const worktreeRef = { worktreeId: z.string().min(1) }
/** Absent = every entry of the group (Stage All / Unstage All / Discard All). */
const pathsRef = { paths: z.array(RepoPathSchema).min(1).optional() }

/** Why a git call failed, for an i18n message (`git-changes:scm.errors.<code>`); `detail` is git's stderr. */
export const SCM_ERROR_CODES = [
  'gitFailed',
  'authFailed',
  'conflict',
  'localChanges',
  'nonFastForward',
  'noUpstream',
  'noRemote',
  'detachedHead',
  'nothingToCommit',
  'nothingToStash',
  'emptyMessage',
  'hunkStale',
  'stashNotFound',
] as const
export type ScmErrorCode = (typeof SCM_ERROR_CODES)[number]
export const ScmResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), code: z.enum(SCM_ERROR_CODES), detail: z.string() }),
])
export type ScmResult = z.infer<typeof ScmResultSchema>

/** Branch and sync state (VS Code's status bar: `↓behind ↑ahead`, "Publish Branch" without an upstream). */
export const ScmStateSchema = z.object({
  branch: z.string().nullable(),
  upstream: z.string().nullable(),
  ahead: count,
  behind: count,
  hasHead: z.boolean(),
  /** A remote exists (without one there is nothing to publish to). */
  hasRemote: z.boolean(),
})
export type ScmState = z.infer<typeof ScmStateSchema>

/** One `@@ -a,b +c,d @@` hunk of a file's staged or unstaged git diff; `header` identifies it when applied. */
export const HunkInfoSchema = z.object({
  header: z.string().min(1),
  oldStart: count,
  oldLines: count,
  newStart: count,
  newLines: count,
})
export type HunkInfo = z.infer<typeof HunkInfoSchema>

export const StashEntrySchema = z.object({ index: count, sha: ShaSchema, message: z.string() })
export type StashEntry = z.infer<typeof StashEntrySchema>

export const HUNK_ACTIONS = ['stage', 'unstage', 'discard'] as const
export type HunkAction = (typeof HUNK_ACTIONS)[number]
export const STASH_ACTIONS = ['apply', 'pop', 'drop'] as const
export type StashAction = (typeof STASH_ACTIONS)[number]
export const REMOTE_ACTIONS = ['fetch', 'pull', 'pullRebase', 'push', 'sync'] as const
export type RemoteAction = (typeof REMOTE_ACTIONS)[number]

export const scmStateIpc = defineIpc({
  channel: GIT_SCM_CHANNELS.state,
  input: z.object(worktreeRef),
  output: ScmStateSchema,
})
export const scmHunksIpc = defineIpc({
  channel: GIT_SCM_CHANNELS.hunks,
  input: z.object({ ...worktreeRef, path: RepoPathSchema, staged: z.boolean() }),
  output: z.object({ hunks: z.array(HunkInfoSchema) }),
})
export const scmStageIpc = defineIpc({
  channel: GIT_SCM_CHANNELS.stage,
  input: z.object({ ...worktreeRef, ...pathsRef }),
  output: ScmResultSchema,
})
export const scmUnstageIpc = defineIpc({
  channel: GIT_SCM_CHANNELS.unstage,
  input: z.object({ ...worktreeRef, ...pathsRef }),
  output: ScmResultSchema,
})
/** Tracked files go back to their index version, untracked ones are deleted (the renderer confirms first). */
export const scmDiscardIpc = defineIpc({
  channel: GIT_SCM_CHANNELS.discard,
  input: z.object({ ...worktreeRef, ...pathsRef }),
  output: ScmResultSchema,
})
export const ApplyHunkInputSchema = z.object({
  ...worktreeRef,
  path: RepoPathSchema,
  /** `stage` / `discard` take a hunk of the unstaged diff, `unstage` one of the staged diff. */
  action: z.enum(HUNK_ACTIONS),
  header: z.string().min(1),
})
export type ApplyHunkInput = z.infer<typeof ApplyHunkInputSchema>
export const scmApplyHunkIpc = defineIpc({
  channel: GIT_SCM_CHANNELS.applyHunk,
  input: ApplyHunkInputSchema,
  output: ScmResultSchema,
})
export const CommitInputSchema = z.object({
  ...worktreeRef,
  message: z.string(),
  amend: z.boolean(),
  signoff: z.boolean(),
  /** Smart commit: stage every change first (asked when nothing is staged). */
  stageAll: z.boolean(),
})
export type CommitInput = z.infer<typeof CommitInputSchema>
export const scmCommitIpc = defineIpc({
  channel: GIT_SCM_CHANNELS.commit,
  input: CommitInputSchema,
  output: ScmResultSchema,
})
/** `reset --soft HEAD~1`: the commit's changes stay staged. */
export const scmUndoCommitIpc = defineIpc({
  channel: GIT_SCM_CHANNELS.undoCommit,
  input: z.object(worktreeRef),
  output: ScmResultSchema,
})
export const scmStashListIpc = defineIpc({
  channel: GIT_SCM_CHANNELS.stashList,
  input: z.object(worktreeRef),
  output: z.object({ stashes: z.array(StashEntrySchema) }),
})
export const StashPushInputSchema = z.object({
  ...worktreeRef,
  message: z.string(),
  includeUntracked: z.boolean(),
  staged: z.boolean(),
})
export type StashPushInput = z.infer<typeof StashPushInputSchema>
export const scmStashPushIpc = defineIpc({
  channel: GIT_SCM_CHANNELS.stashPush,
  input: StashPushInputSchema,
  output: ScmResultSchema,
})
/** A stash is named by its commit sha (indexes shift as stashes come and go). */
export const scmStashIpc = defineIpc({
  channel: GIT_SCM_CHANNELS.stash,
  input: z.object({ ...worktreeRef, action: z.enum(STASH_ACTIONS), sha: ShaSchema }),
  output: ScmResultSchema,
})
export const scmStashClearIpc = defineIpc({
  channel: GIT_SCM_CHANNELS.stashClear,
  input: z.object(worktreeRef),
  output: ScmResultSchema,
})
/** The files a stash changed (tracked against its base, untracked ones as `U`); diff them with `fileContents`. */
export const scmStashFilesIpc = defineIpc({
  channel: GIT_SCM_CHANNELS.stashFiles,
  input: z.object({ ...worktreeRef, sha: ShaSchema }),
  output: z.object({ files: z.array(ChangedFileSchema) }),
})
export const scmRemoteIpc = defineIpc({
  channel: GIT_SCM_CHANNELS.remote,
  input: z.object({ ...worktreeRef, action: z.enum(REMOTE_ACTIONS) }),
  output: ScmResultSchema,
})

/** What a destructive operation is about to throw away (`modules/local-history` snapshots it). */
export const DESTRUCTIVE_REASONS = [
  'discard',
  'discardHunk',
  'discardAll',
  'cleanUntracked',
  'stashDrop',
  'stashClear',
  'undoCommit',
] as const
export type DestructiveReason = (typeof DESTRUCTIVE_REASONS)[number]

/**
 * Handed to every `onBeforeDestructive` handler before git runs. `paths`: the files whose worktree content is about
 * to change (read them from `cwd` now); `stashes`: the stashes about to be dropped; `headSha`: the commit being undone.
 */
export interface DestructiveSnapshot {
  worktreeId: string
  cwd: string
  reason: DestructiveReason
  paths: string[]
  stashes: StashEntry[]
  headSha: string | null
}
export type BeforeDestructive = (snapshot: DestructiveSnapshot) => Promise<void> | void

/**
 * Main-side extension point (`GitScmHooksToken`): handlers run, awaited in registration order, before every discard,
 * untracked delete, stash drop/clear and undo commit. A failing handler is logged and does not block the operation.
 */
export interface GitScmHooks {
  onBeforeDestructive(handler: BeforeDestructive): Disposable
}
export const GitScmHooksToken = createServiceToken<GitScmHooks>('git-changes.scmHooks')
