import type { ConfirmInput } from '@pragma/sdk'
import {
  type ChangedFile,
  FILE_STATUS,
  HUNK_ACTIONS,
  type HunkAction,
  type RemoteAction,
  SCM_ERROR_CODES,
  type ScmResult,
  STASH_ACTIONS,
  type StashAction,
  type StashEntry,
  scmApplyHunkIpc,
  scmCommitIpc,
  scmDiscardIpc,
  scmRemoteIpc,
  scmStageIpc,
  scmStashClearIpc,
  scmStashIpc,
  scmStashPushIpc,
  scmUndoCommitIpc,
  scmUnstageIpc,
} from '../../contract'
import { getRendererCtx } from '../lib/sdk'
import { useScmStore } from './scm-store'

/** VS Code's three Stash commands: tracked changes, including untracked files, staged changes only. */
export const STASH_KINDS = ['tracked', 'untracked', 'staged'] as const
export type StashKind = (typeof STASH_KINDS)[number]
const [, UNTRACKED_KIND, STAGED_KIND] = STASH_KINDS
const [GIT_FAILED] = SCM_ERROR_CODES
const [, , DISCARD_HUNK] = HUNK_ACTIONS
const [, , DROP] = STASH_ACTIONS

export interface CommitOptions {
  amend: boolean
  signoff: boolean
}
/** What the list looks like when Commit is pressed (decides the smart-commit question). */
export interface CommitContext {
  message: string
  hasStaged: boolean
  hasChanges: boolean
}

const confirm = (input: ConfirmInput): Promise<boolean> =>
  getRendererCtx().dialogs.confirm({ destructive: true, ...input })

/** The confirmation of a discard: delete one untracked file, discard one file, or discard several. */
function discardQuestion(files: readonly ChangedFile[]): ConfirmInput {
  const [only] = files
  const untracked = files.filter((f) => f.status === FILE_STATUS.U).length
  if (files.length === 1 && only?.status === FILE_STATUS.U)
    return {
      titleKey: 'git-changes:scm.confirm.deleteTitle',
      messageKey: 'git-changes:scm.confirm.deleteFile',
      confirmKey: 'git-changes:scm.confirm.deleteAction',
      params: { file: only.path },
    }
  if (files.length === 1)
    return {
      titleKey: 'git-changes:scm.confirm.discardTitle',
      messageKey: 'git-changes:scm.confirm.discardFile',
      confirmKey: 'git-changes:scm.confirm.discardAction',
      params: { file: only?.path ?? '' },
    }
  return {
    titleKey: 'git-changes:scm.confirm.discardTitle',
    messageKey: untracked > 0 ? 'git-changes:scm.confirm.discardManyUntracked' : 'git-changes:scm.confirm.discardMany',
    confirmKey: 'git-changes:scm.confirm.discardManyAction',
    params: { count: files.length, untracked },
  }
}

/** Runs one operation: clears the last error, counts it as running, keeps its failure for the banner. */
async function run(worktreeId: string, call: () => Promise<ScmResult>): Promise<boolean> {
  const store = useScmStore.getState()
  store.setError(worktreeId, null)
  store.track(worktreeId, 1)
  try {
    const r = await call()
    if (!r.ok) store.setError(worktreeId, { code: r.code, detail: r.detail })
    return r.ok
  } catch (e) {
    store.setError(worktreeId, { code: GIT_FAILED, detail: e instanceof Error ? e.message : String(e) })
    return false
  } finally {
    store.track(worktreeId, -1)
  }
}

/** Source Control operations of one worktree (IPC + confirmations + error feedback). */
export function scmActions(worktreeId: string) {
  const ipc = () => getRendererCtx().ipc
  const paths = (files?: readonly ChangedFile[]) => (files ? { paths: files.map((f) => f.path) } : {})
  return {
    /** Stage these entries, or every change. */
    stage: (files?: readonly ChangedFile[]) =>
      run(worktreeId, () => ipc().invoke(scmStageIpc, { worktreeId, ...paths(files) })),
    unstage: (files?: readonly ChangedFile[]) =>
      run(worktreeId, () => ipc().invoke(scmUnstageIpc, { worktreeId, ...paths(files) })),
    /** Asks first; `all`: every unstaged change (Discard All Changes). */
    async discard(files: readonly ChangedFile[], all = false): Promise<boolean> {
      if (files.length === 0 || !(await confirm(discardQuestion(files)))) return false
      return run(worktreeId, () => ipc().invoke(scmDiscardIpc, { worktreeId, ...(all ? {} : paths(files)) }))
    },
    async applyHunk(path: string, action: HunkAction, header: string): Promise<boolean> {
      if (action === DISCARD_HUNK) {
        const ok = await confirm({
          titleKey: 'git-changes:scm.confirm.discardTitle',
          messageKey: 'git-changes:scm.confirm.discardHunk',
          confirmKey: 'git-changes:scm.confirm.discardAction',
          params: { file: path },
        })
        if (!ok) return false
      }
      return run(worktreeId, () => ipc().invoke(scmApplyHunkIpc, { worktreeId, path, action, header }))
    },
    /** Smart commit: with nothing staged, asks to stage everything first (VS Code's question). */
    async commit(ctx: CommitContext, opts: CommitOptions): Promise<boolean> {
      let stageAll = false
      if (!opts.amend && !ctx.hasStaged && ctx.hasChanges) {
        stageAll = await confirm({
          titleKey: 'git-changes:scm.confirm.smartCommitTitle',
          messageKey: 'git-changes:scm.confirm.smartCommit',
          confirmKey: 'git-changes:scm.confirm.smartCommitAction',
          destructive: false,
        })
        if (!stageAll) return false
      }
      return run(worktreeId, () => ipc().invoke(scmCommitIpc, { worktreeId, message: ctx.message, ...opts, stageAll }))
    },
    undoCommit: () => run(worktreeId, () => ipc().invoke(scmUndoCommitIpc, { worktreeId })),
    stashPush: (kind: StashKind, message: string) =>
      run(worktreeId, () =>
        ipc().invoke(scmStashPushIpc, {
          worktreeId,
          message,
          includeUntracked: kind === UNTRACKED_KIND,
          staged: kind === STAGED_KIND,
        }),
      ),
    async stash(action: StashAction, entry: StashEntry): Promise<boolean> {
      if (action === DROP) {
        const ok = await confirm({
          titleKey: 'git-changes:scm.confirm.dropTitle',
          messageKey: 'git-changes:scm.confirm.dropStash',
          confirmKey: 'git-changes:scm.confirm.dropAction',
          params: { stash: entry.message },
        })
        if (!ok) return false
      }
      return run(worktreeId, () => ipc().invoke(scmStashIpc, { worktreeId, action, sha: entry.sha }))
    },
    async stashClear(count: number): Promise<boolean> {
      const ok = await confirm({
        titleKey: 'git-changes:scm.confirm.dropTitle',
        messageKey: 'git-changes:scm.confirm.dropAll',
        confirmKey: 'git-changes:scm.confirm.dropAllAction',
        params: { count },
      })
      return ok && run(worktreeId, () => ipc().invoke(scmStashClearIpc, { worktreeId }))
    },
    remote: (action: RemoteAction) => run(worktreeId, () => ipc().invoke(scmRemoteIpc, { worktreeId, action })),
  }
}
export type ScmActions = ReturnType<typeof scmActions>
