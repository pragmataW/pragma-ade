# Task Board (`@pragma/module-board`)

Jira-like kanban board (phase 09): one board per project plus an "All projects" view, cards with Markdown
description, priority, labels, a linked worktree and linked agent sessions, persistent drag-and-drop ordering, and a
one-click "Start in new worktree with agent" flow.

Dependencies: `projects`, `agents` (required), `agent-status` (optional: without it no status is shown and nothing
fails).

## Provides

### Service `BoardServiceToken` (`board.service`, main)

Every mutation emits the main event `board.changed` (`{ projectId, taskIds, kind }`) exactly once after it committed,
whoever the caller is (IPC, phase 10's CLI, another module).

Reference conventions:

- `ColumnRef`: a number is a column id (must be in the task's board); a string is a column name, trimmed and
  case-insensitive, resolved within the task's own board.
- `TaskRef`: a number or an all-digit string is a task id; otherwise a key like `PRA-12` (case-insensitive).
- `LabelRef`: a number is a label id of the board; a string is a label name, created on write when missing.
- Task ids, column ids, label ids and board ids are integers; project/worktree/session/profile ids are strings.
- Key prefixes are unique: a second project whose name gives `PRA` gets `PRA2`.

| Method | What it does |
|---|---|
| `getBoard(projectId)` | The project's board section; creates the board and the default columns (Backlog, Todo, In Progress, Review, Done) on first call. |
| `getSnapshot(scope)` | Sections + tasks for `{ kind: 'project', projectId }` or `{ kind: 'all' }` (boards of projects no longer listed are hidden, rows are kept). |
| `listTasks(filter?)` | Tasks in column order, then sort key; filter by `projectId`, `column`, `worktreeId`, `sessionId`, `labels`, `priorities`, `hasWorktree`, `query`. `listTasks({ sessionId })` finds the cards linked to an agent session. |
| `getTask(ref)` | One task or null. |
| `createTask(input)` | Default column = first, default position = end. |
| `updateTask(id, patch)` | Title, `descriptionMd`, priority, labels, `worktreeId` (must be a worktree of the task's project). |
| `deleteTask(id)` | Also removes its session links. |
| `moveTask(id, column, position?)` | `position` = `{ afterTaskId }` or `{ beforeTaskId }`; the server computes the fractional key from the neighbours, so a filtered view never corrupts order. |
| `linkSession` / `unlinkSession` | Idempotent link between a task and an agent session. |
| `createColumn` / `renameColumn` / `moveColumn` / `deleteColumn` | Names unique per board (case-insensitive); the last column cannot be deleted; a non-empty column needs `moveTasksTo`. |
| `createLabel` / `updateLabel` / `deleteLabel` | Labels per board; deleting a label removes it from every task. |
| `prepareStart(taskId)` | Suggested branch `feat/<key>-<slug>` (taken → `-2`, `-3`…), base branches, enabled profiles, worktrees. |
| `checkBranch(projectId, branch)` | `{ ok: true }` or `{ ok: false, reason: 'invalid' \| 'exists' }`. |
| `startInNewWorktree(input)` | Validate → create worktree → link it → start session (task prompt, `promptOverride`, or none) → link session → move to In Progress (setting). A failing agent start keeps the worktree link and moves nothing. |
| `startInWorktree(input)` | The same from an existing worktree of the task's project. |

### IPC (`board.*`)

One channel per service method (answers are `Result<T, BoardErrorDto>`, so error codes survive IPC) plus
`board.resolveDefaultScope`, `board.listProjects`, `board.openCount`. Push events: `board.changedEvent`
(`{ projectIds }`, debounced, driven by `board.changed` and `project.removed`) and
`board.sessionStatusChangedEvent` (status of a linked session, from `agentSession.statusChanged`).

### Renderer

- Center view `board` (`hideRightPanel: true`), `sidebar.footer` entry "Task Board" with the open-task count.
- Command `board.open { projectId? }` (palette).
- Slot owned: `board.card.badges`, props `{ taskId, sessionIds }` (agent-status renders the card status there).
- Settings page "Task Board" (order 100): send task as first prompt by default; move card to In Progress on start.

### Tables and migration

`migrations/0901_board.sql`: `board_boards`, `board_columns`, `board_labels`, `board_tasks`,
`board_task_sessions`. No foreign keys to other modules' tables.

### Testing

- `BOARD_TESTIDS` / `BOARD_TESTID_ATTRS` from `@pragma/module-board/contract`.
- `@pragma/module-board/testing`: `BoardPage` (Playwright): `open`, `selectScope`, `column`, `columnNames`, `card`,
  `cardsIn`, `allCards`, `quickAdd`, `openCard`, `filter`, `dragCard`, `dragColumn`, `expectDropTarget`,
  `keyboardMoveTo`.
