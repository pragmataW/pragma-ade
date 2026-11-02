import { type ChangedFile, REMOTE_ACTIONS, STASH_ACTIONS, type StashEntry } from '../../contract'
import { type CommitOptions, type ScmActions, STASH_KINDS, type StashKind } from './actions'
import type { MenuEntry, MenuGroup } from './ScmMenu'

const [FETCH, PULL, PULL_REBASE, PUSH, SYNC] = REMOTE_ACTIONS
const [APPLY, POP] = STASH_ACTIONS
const [TRACKED, UNTRACKED, STAGED] = STASH_KINDS

export interface ScmMenuContext {
  actions: ScmActions
  commit(opts: CommitOptions): void
  /** Opens the stash message prompt for this kind of stash. */
  promptStash(kind: StashKind): void
  unstaged: readonly ChangedFile[]
  stashes: readonly StashEntry[]
  hasHead: boolean
}

/** The split Commit button's menu (also the "…" menu's Commit submenu). */
export function commitEntries(c: Pick<ScmMenuContext, 'actions' | 'commit' | 'hasHead'>): MenuEntry[] {
  return [
    { id: 'commit', labelKey: 'git-changes:scm.menu.commit', run: () => c.commit({ amend: false, signoff: false }) },
    {
      id: 'commitAmend',
      labelKey: 'git-changes:scm.menu.commitAmend',
      run: () => c.commit({ amend: true, signoff: false }),
    },
    {
      id: 'commitSignoff',
      labelKey: 'git-changes:scm.menu.commitSignoff',
      run: () => c.commit({ amend: false, signoff: true }),
    },
    {
      id: 'undoCommit',
      labelKey: 'git-changes:scm.menu.undoCommit',
      run: () => void c.actions.undoCommit(),
      disabled: !c.hasHead,
    },
  ]
}

/** VS Code's "…" view menu: Pull / Push / Fetch, then Commit, Changes, Pull-Push and Stash submenus. */
export function scmMenuModel(c: ScmMenuContext): { top: MenuEntry[]; groups: MenuGroup[] } {
  const { actions } = c
  const remote = (action: (typeof REMOTE_ACTIONS)[number]) => () => void actions.remote(action)
  const [latest] = c.stashes
  const onLatest = (action: typeof APPLY | typeof POP) => () => {
    if (latest) void actions.stash(action, latest)
  }
  return {
    top: [
      { id: 'pull', labelKey: 'git-changes:scm.menu.pull', run: remote(PULL) },
      { id: 'push', labelKey: 'git-changes:scm.menu.push', run: remote(PUSH) },
      { id: 'fetch', labelKey: 'git-changes:scm.menu.fetch', run: remote(FETCH) },
    ],
    groups: [
      { id: 'commitGroup', labelKey: 'git-changes:scm.menu.commitGroup', items: commitEntries(c) },
      {
        id: 'changesGroup',
        labelKey: 'git-changes:scm.menu.changesGroup',
        items: [
          { id: 'stageAll', labelKey: 'git-changes:scm.menu.stageAll', run: () => void actions.stage() },
          { id: 'unstageAll', labelKey: 'git-changes:scm.menu.unstageAll', run: () => void actions.unstage() },
          {
            id: 'discardAll',
            labelKey: 'git-changes:scm.menu.discardAll',
            run: () => void actions.discard(c.unstaged, true),
            disabled: c.unstaged.length === 0,
          },
        ],
      },
      {
        id: 'remoteGroup',
        labelKey: 'git-changes:scm.menu.remoteGroup',
        items: [
          { id: 'sync', labelKey: 'git-changes:scm.menu.sync', run: remote(SYNC) },
          { id: 'remotePull', labelKey: 'git-changes:scm.menu.pull', run: remote(PULL) },
          { id: 'pullRebase', labelKey: 'git-changes:scm.menu.pullRebase', run: remote(PULL_REBASE) },
          { id: 'remotePush', labelKey: 'git-changes:scm.menu.push', run: remote(PUSH) },
          { id: 'fetchPrune', labelKey: 'git-changes:scm.menu.fetchPrune', run: remote(FETCH) },
        ],
      },
      {
        id: 'stashGroup',
        labelKey: 'git-changes:scm.menu.stashGroup',
        items: [
          { id: 'stash', labelKey: 'git-changes:scm.menu.stash', run: () => c.promptStash(TRACKED) },
          {
            id: 'stashUntracked',
            labelKey: 'git-changes:scm.menu.stashUntracked',
            run: () => c.promptStash(UNTRACKED),
          },
          { id: 'stashStaged', labelKey: 'git-changes:scm.menu.stashStaged', run: () => c.promptStash(STAGED) },
          { id: 'applyLatest', labelKey: 'git-changes:scm.menu.applyLatest', run: onLatest(APPLY), disabled: !latest },
          { id: 'popLatest', labelKey: 'git-changes:scm.menu.popLatest', run: onLatest(POP), disabled: !latest },
          {
            id: 'dropAll',
            labelKey: 'git-changes:scm.menu.dropAll',
            run: () => void actions.stashClear(c.stashes.length),
            disabled: !latest,
          },
        ],
      },
    ],
  }
}
