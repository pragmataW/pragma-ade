# projects — `@pragma/module-projects`

Projects and their git worktrees in the left sidebar (`sidebar.main`), creating and removing worktrees, watching worktree folders and git metadata (files, commits, HEAD, refs) for changed-file counts, and the persisted **active worktree** every other module reads as its context. Core module (`core: true`, no dependencies).

Other modules import only `@pragma/module-projects/contract`. The SQLite tables (`projects_projects`, `projects_worktrees`, `projects_state`) are internal: use `ProjectsService`. Rows are archived, never deleted, so ids stay stable (re-adding a removed project keeps its id).

## Services

**`ProjectsServiceToken`** (main, `projects.service`):
`listProjects()`, `listWorktrees(projectId)`, `getWorktree(id)` (archived too), `getProject(id)`, `createWorktree({ projectId, branch, baseBranch?, path? })` (never selects), `removeWorktree(id, { deleteBranch, force? })` (force defaults to true; the main checkout throws `cannotRemoveMain`), `getActiveWorktreeId()`, `setActiveWorktree(id | null)`, `setBaseBranch(worktreeId, branch)` (07's base picker), `addProject(path)` (any folder inside a repo or a linked worktree resolves to the main repo), `removeProject(id)` (list only, disk untouched), `reorderProjects(ids)`, `syncProject(id)`, `syncAll()`, `getChangedFileCount(worktreeId)`, `getRemovalInfo(id)`, `listBranches(projectId)`, `suggestWorktreePath(projectId, branch)`, `getSnapshot()`.
Failures throw `ProjectsError` with a `code` from `PROJECTS_ERROR_CODES` (`projects:errors.<code>`).

**`GitServiceToken`** (main, `projects.git`): `run(cwd, args, opts?)`, `status(cwd)` (runs with `GIT_OPTIONAL_LOCKS=0`, never writes the index), `mergeBase`, `show`, `defaultBaseBranch(repoPath)` (`origin/HEAD` → `main` → `master` → current branch), plus `resolveRepo`, `gitDirs`, `worktreeList/Add/Remove/Prune`, `branchList/Delete`, `isValidBranchName`, `refExists`, `countCommits`.

**`ProjectsRendererServiceToken`** (renderer, `projects.renderer`): `getSnapshot()`, `getActiveWorktree()`, `subscribe(listener)` (`useSyncExternalStore`-compatible), `selectWorktree(id | null)`.

## Events (main bus, `ctx.events`)

| Event | Payload |
|---|---|
| `worktree.created` | `{ worktree }` |
| `worktree.removed` | `{ worktreeId, projectId, path, reason: 'user' \| 'external' \| 'projectRemoved' }` |
| `worktree.changed` | `{ worktreeId, path, reason, changedPaths, truncated }` — `files`: debounced (300 ms) file batch, worktree-relative paths capped at 500; `head`: commit / checkout / HEAD / index / ref change (empty `changedPaths`); `baseBranch`: `setBaseBranch` |
| `worktree.selected` | `{ worktreeId, previousWorktreeId }` |
| `project.removed` | `{ projectId, repoPath }` |

## IPC

Requests (`projectsIpc`): `projects.getState`, `pickFolder`, `addProject`, `removeProject`, `reorderProjects`, `syncProject`, `listBranches`, `suggestWorktreePath`, `createWorktree` (`select` defaults to true), `getRemovalInfo`, `removeWorktree`, `selectWorktree`, `setBaseBranch`, `getSettings`, `updateSettings`. Every mutation answers `Result<T, ProjectsErrorDto>`.
Sidebar folders: `getFolders` (`FoldersSnapshot` = `{ [projectId]: WorktreeFolder[] }`), `createFolder { projectId, name, worktreeId? }`, `renameFolder`, `deleteFolder` (members go back to the root; no worktree is removed), `setFolderCollapsed`, `moveWorktreeToFolder { worktreeId, folderId | null }`.
Events (`projectsIpcEvents`, main → renderer): `projects.stateChanged` (full snapshot), `projects.statusChanged` (`{ worktreeId, changedFiles, upstream, ahead, behind }`), `projects.selected`, `projects.foldersChanged` (`FoldersSnapshot`).

## Sidebar folders

User-made, per project, renderer organisation only (git, the CLI and `ProjectsService` do not see them). Stored in `projects_state` under `folders:<projectId>` as JSON `{ folders: [{ id, name, collapsed, worktreeIds }] }`, read through a zod schema with defaults (an unreadable value or folder is skipped). Every read drops worktree ids that are no longer live; a worktree is in at most one folder and new worktrees show at the project root. Move rows by native drag and drop (onto a folder, or onto the tree outside folders for the root) or with the row menu (Move to folder ▸). The tree follows the WAI-ARIA tree pattern: a folder item takes Enter/Space (toggle), →/← (expand/collapse), F2 (rename).

## Slots

Hosted by the worktree row, props `WorktreeRowSlotProps = { worktreeId, projectId, isActive }`:
- `sidebar.worktreeRow.leading` — before the branch (status icon, 04);
- `sidebar.worktreeRow.badges` — after the branch; projects registers the changed-file count (order 10);
- `sidebar.worktreeRow.subtitle` — second line (first entry wins; default "main checkout").

Hosted by a collapsed sidebar folder, props `WorktreeFolderSlotProps = { projectId, folderId, worktreeIds }`:
- `sidebar.worktreeFolder.leading` — aggregated status of the members; without entries the folder shows each member's `sidebar.worktreeRow.leading`.

Shell slots filled (via `ShellSlots`): `sidebar.main` (project tree), `titlebar.left` (`project › branch`), `statusbar.left` order 10 (branch + ahead/behind; other status items come after it).

## Commands

`projects.selectWorktree { worktreeId }` (main), `projects.addProject` and `projects.newWorktree { projectId? }` (renderer, in the palette).

## Settings

Section `projects`: `{ worktreesRoot }` (default `~/pragma/worktrees`; absolute or `~`). New worktrees go to `<root>/<project-slug>/<branch-slug>` (`-2`, `-3`… when taken). Settings page `projects`, order 45.

## Test ids

`PROJECTS_TESTIDS` and `PROJECTS_DATA_ATTRS` (`data-project-name`, `data-branch`, `data-main`, `data-active`, `data-folder-id`, `data-folder-name`) from `@pragma/module-projects/contract`.

## Notes

- `@parcel/watcher` is a native module (packaging must unpack it).
- Tests: `pnpm --filter @pragma/module-projects test`; E2E: `pnpm e2e modules/projects/e2e`.
