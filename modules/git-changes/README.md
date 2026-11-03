# git-changes — `@pragma/module-git-changes`

Right-panel tab **Git Changes** (phase 07): a worktree's changes in two modes (**Uncommitted** | **Committed on branch**), a compressed indented file tree and a full-file diff with collapsed unchanged regions. Diff lines are commented through the comments pipeline (05).

- Manifest: id `git-changes`, `dependsOn: ["projects", "comments"]`, `optionalDependsOn: ["editor"]`.
- Entries: `./contract` (anywhere), `./main` / `./renderer` (loader only), `./testing` (test code only).
- No database tables: the base branch belongs to projects (`ProjectsService.setBaseBranch`), the diff side to comments (`Comment.diffSide`).

## Upstream names verified (Task 1)

Checked against the merged code on `main` (projects 01, comments 05, agents 03, SDK 00).

| Name | Result |
|---|---|
| `GitServiceToken` → `run(cwd, args, {allowFailure?})`, `mergeBase`, `show`, `countCommits` | As planned. `run` returns the exec result as-is (stdout untrimmed); `show` returns untrimmed stdout or null. `run` already prefixes `-c core.quotepath=false` (07 still adds `GIT_FLAGS` itself, harmless). |
| `ProjectsServiceToken` → `getWorktree`, `listBranches(projectId)`, `setBaseBranch(worktreeId, branch)` | As planned; `setBaseBranch` resolves to the updated `Worktree` and itself emits `worktree.changed` (`reason: 'baseBranch'`). `Worktree.branch` is nullable (detached HEAD). |
| Event `worktree.changed` | Payload has an extra `reason: 'files' \| 'head' \| 'baseBranch'`. Commits and ref changes fire it (`reason: 'head'`, git common-dir watcher in `projects/src/main/watching.ts`), so no focus refetch is needed. |
| `ProjectsRendererServiceToken` → `getActiveWorktree`, `getSnapshot().changedFiles`, `subscribe` | As planned. |
| `CommentsUiServiceToken` → `CommentComposer`, `ThreadView`, `openDrawer(args?)`, `send({ worktreeId? })`, `clearResolved(worktreeId)` | `send` delivers the worktree's whole review round. `CommentContext` is `z.input` of `CommentContextSchema`. |
| Comments IPC `commentsIpc.list/remove`, event `commentsIpcEvents.changed` | `Comment.filePath`, `lineStart`, `lineEnd`, `diffSide` are optional. Since the review-threads change comments are kept as threads (`status` open/resolved, `replies`, `round`; no `round` = pending). The diff shows diff threads on their side and editor threads on the new side of their file (browser threads never); cards stay after Send with their replies. The tree marker counts open code threads per file; the review bar counts every pending item of the worktree (editor and browser ones too), Discard deletes only the diff's unsent threads, Clear resolved goes through 05 (SDK confirm). |
| SDK `defineIpc`, `defineIpcEvent`, `ctx.ipc.publish`, `ctx.panels.registerRightTab/activateRightTab/setBadge`, `ctx.theme.get().resolved`, `useLatestAsync(fn(signal), deps) → {data, error, loading, reload}`, `useT`, `useModuleSettings`, `useRendererContext`, `useTheme` | As planned. `useLatestAsync` keeps the previous `data` while a new key loads, so 07 tags results with their key. |
| Test support `createFixtureRepo` (sync; `git()` trims stdout), `createTempUserData`, `launchApp({ env, disabledModules })`, `invoke`/`invokeIpc`, `executeCommand`, `openCommandPalette`; agents `createFakeAgentProfile`, `waitForFakeAgentLog`, `readFakeAgentLog` | As planned (no `fakeAgentCommand`; the profile helper covers it). |
| CSS tokens `--ok --warn --err --info`, `--add-tx`, `--del-tx`, `--font-code` | Present in `packages/ui/src/styles/tokens.css`. |

## Provides

### IPC (`src/contract/ipc.ts`, channels `GIT_CHANGES_CHANNELS`)

| Contract | Channel | Input → output |
|---|---|---|
| `listChangesIpc` | `git-changes.list` | `{worktreeId, mode}` → `ChangeList` (`ok` \| `baseNotFound` \| `noMergeBase`) |
| `fileContentsIpc` | `git-changes.fileContents` | `{worktreeId, mode, path, oldPath?, status}` → `FileDiffContents` (`old`/`new`: `text` \| `binary` \| `tooLarge` \| `absent` \| `unreadable`) |
| `listBranchesIpc` | `git-changes.listBranches` | `{worktreeId}` → `{branches: {name, kind}[]}` (local first) |
| `setBaseBranchIpc` | `git-changes.setBaseBranch` | `{worktreeId, baseBranch}` → `{}` (through `ProjectsService.setBaseBranch`) |
| `changesChangedEvent` | `git-changes.changed` | main → renderer `{worktreeId}`; forwarded from `worktree.changed` (files, commits, refs, base) |

Modes: `uncommitted` = HEAD (or the empty tree) ↔ working tree incl. untracked; `branch` = `merge-base(base, HEAD)` ↔ HEAD. Paths are `RepoPathSchema` (relative, no `..`, no NUL/backslash); every git call uses `-z`, `-c core.quotepath=false` and `--`. Unknown worktree → `worktreeNotFound`.

### Command, tab, badge

- `gitChanges.reveal {worktreeId, path}` (renderer, `REVEAL_COMMAND_ID`, args `RevealArgsSchema`): picks the mode that lists the file (uncommitted first), selects it and activates the tab.
- Right tab `git-changes` (`Git Changes`, icon `git-compare`, order 40). Badge = 01's changed-file count of the active worktree (hidden at 0).
- Keys inside the panel: `j`/`k` next/previous file, `n`/`Shift+N` next/previous change (not while typing).

### Settings (`git-changes` section, `GitChangesSettingsSchema`)

`maxFileBytes` (1 MB), `viewMode` (`tree` \| `list`), `diffStyle` (`unified` \| `split`), `showFullFile` (false). The toolbar toggles write them.

### Test ids (`GitChangesTestIds`, all `gc-…`)

`panel`, `mode(m)`, `basePicker`, `baseError`, `totals`, `toggleView`, `toggleStyle`, `toggleFull`, `tree`, `treeRow` (`data-path`, `data-kind`, `data-depth`, `data-status`, `data-selected`), `empty` (`data-kind`), `diff` (`data-path`), `diffHeader`, `placeholder` (`data-kind`), `openInEditor`, `prevChange`, `nextChange`, `reviewBar`, `reviewSend`, `reviewDiscard`, `reviewClearResolved`, `commentCard` (`data-comment-id`; the thread inside uses 05's `COMMENTS_TESTIDS.thread*`).

### Testing (`@pragma/module-git-changes/testing`)

`buildStandardFixture()` / `buildEmptyFixture()`, `STANDARD_EXPECT`, `execGitPort()`, `fakeMainCtx()`. Test hooks (PRAGMA_TEST): with `PRAGMA_TEST_FAKE_EDITOR=1` and no `editor.openFile`, a recording fake plus IPC `git-changes.test.editorCalls`.

## Consumes

- projects (01): `GitServiceToken` (`run`, `mergeBase`, `show`, `countCommits`), `ProjectsServiceToken` (`getWorktree`, `listBranches`, `setBaseBranch`), event `worktree.changed`, `ProjectsRendererServiceToken` (active worktree, `changedFiles`).
- comments (05): `CommentsUiServiceToken` (`CommentComposer`, `ThreadView`, `openDrawer`, `send`, `clearResolved`), `commentsIpc.list/remove`, `commentsIpcEvents.changed`, `Comment.diffSide`, `isCodeThread`, `pendingCount`.
- editor (06, optional): command `editor.openFile {worktreeId, path, line}`; "Open in editor" only appears when the command exists, then the `files` tab is activated.
- Libraries: `@pierre/diffs` 1.6.2 (Apache-2.0, `MultiFileDiff`), `react-arborist` 4.0.1 (MIT) with `react-dnd` / `react-dnd-html5-backend` 16.0.1.
