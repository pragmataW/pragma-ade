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
| `CommentsUiServiceToken` → `CommentComposer`, `openDrawer(args?)`, `send(ids, opts?)` | As planned (`send` takes an optional `{ preferredSessionId }`). `CommentContext` is `z.input` of `CommentContextSchema`. |
| Comments IPC `commentsIpc.listDrafts/listSent/remove`, event `commentsIpcEvents.changed` | As planned; `Comment.filePath`, `lineStart`, `lineEnd`, `diffSide` are optional. |
| SDK `defineIpc`, `defineIpcEvent`, `ctx.ipc.publish`, `ctx.panels.registerRightTab/activateRightTab/setBadge`, `ctx.theme.get().resolved`, `useLatestAsync(fn(signal), deps) → {data, error, loading, reload}`, `useT`, `useModuleSettings`, `useRendererContext`, `useTheme` | As planned. `useLatestAsync` keeps the previous `data` while a new key loads, so 07 tags results with their key. |
| Test support `createFixtureRepo` (sync; `git()` trims stdout), `createTempUserData`, `launchApp({ env, disabledModules })`, `invoke`/`invokeIpc`, `executeCommand`, `openCommandPalette`; agents `createFakeAgentProfile`, `waitForFakeAgentLog`, `readFakeAgentLog` | As planned (no `fakeAgentCommand`; the profile helper covers it). |
| CSS tokens `--ok --warn --err --info`, `--add-tx`, `--del-tx`, `--font-code` | Present in `packages/ui/src/styles/tokens.css`. |
