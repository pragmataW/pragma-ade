# Changelog

All notable changes to Pragma ADE are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.9.2] - 2026-11-02

### Added

- **Source Control in Git Changes:** VS Code's flow in the panel. Staged and unstaged groups; stage, unstage and
  discard per file, per hunk or all; commit with ⌘/Ctrl+Enter (smart commit, amend, signed-off, undo last commit);
  stashes (push with or without untracked files or staged only, apply, pop, drop, clear, browse their files); fetch,
  pull, push, Publish Branch and a "Sync Changes ↓ ↑" button. The changed-files list collapses fully.
- **Local History:** whatever Git Changes discards, deletes, drops or undoes is saved first and can be restored per
  entry or per file (a restore is itself undoable; dropped stashes and undone commits come back too). Kept 7 days and
  up to 512 MB by default (Settings › Local History); each worktree shows its own entries.
- **Find in diff:** Cmd/Ctrl+F searches the open file's diff (case-insensitive, Turkish letters included).
- **Movable panels:** the right panel docks left, right, top or bottom and the sidebar can switch sides — from the
  panel's menu, the command palette, or by dragging its grip onto an edge. Pane moves and collapses are animated.
- **File icons:** Material icons in Git Changes, Local History and the editor's explorer.
- **Settings › Beta:** switch agent chat mode off (and back on).

### Changed

- The editor uses the app's fonts (Inter for its chrome, JetBrains Mono for code and its terminal).

### Fixed

- **macOS:** double-clicking the empty title bar zooms the window again; fullscreen drops the traffic-light gutter.
- **Linux, Windows:** no grey native title and menu bar; the window controls sit in the app's title bar, in the theme.
- The editor (and browser) no longer stays hidden while Git Changes shows "Committed on branch".
- A second launch focuses the running app instead of starting another instance on the same data.
- The status bar and Git Changes follow pushes, new remotes and stash changes made outside the panel.

## [0.9.1] - 2026-11-02

### Fixed

- **Linux:** the editor stayed on "Starting editor…" and no terminal opened when the login shell's rc file starts
  another interactive shell (for example a `.bashrc` that runs `zsh`). Reading the shell environment now gives the
  shell an empty stdin and, on timeout, kills the whole process group and falls back to the app environment.
- **Editor comments:** a comment added to the review from the editor vanished from the file. Editor drafts now stay on
  their lines in the workbench as read-only "Pending" threads, like the cards in Git Changes, and disappear once they
  are sent or deleted; an edit in the Comments drawer shows up in the editor too. When a send fails after the comment
  was saved, only the Pending thread remains.

## [0.9.0] - 2026-11-02

First public release. Unsigned builds for macOS (arm64, x64), Linux x64 and Windows x64.

### Added

- **Projects and worktrees:** a sidebar of projects with their git worktrees; create a worktree (new branch from a
  base) or remove one, with agent status and unread markers on every row.
- **Terminal:** xterm.js terminals backed by a separate pty daemon, so sessions survive a UI reload; up to six split
  panes per tab.
- **Agent profiles:** built-in Claude Code and OpenCode 2.x profiles plus custom agents; each profile's command and
  arguments are editable, and profiles can be enabled, disabled or set as default. A launcher starts an agent in the
  current worktree or in a new one.
- **Agent status:** a local bridge (127.0.0.1, token protected) receives hook events from Claude Code and OpenCode and
  shows starting / working / waiting / done / error on tabs, worktree rows and the status bar, with optional
  notifications.
- **Chat view:** Claude Code (stream JSON) and OpenCode (`serve` API) sessions as a chat with streaming output, tool
  calls, permission prompts, `@file` mentions, slash commands and context usage. A session can switch between chat and
  terminal and resume where it left off.
- **Comments to agents:** comment on diff lines, editor lines or browser elements; drafts collect in a drawer and are
  sent to the agent's terminal or chat as one formatted message.
- **Editor:** an embedded VSCodium (`reh-web`) workbench with real VS Code extensions from Open VSX, language servers
  and linters; it is downloaded on first use and follows the app theme.
- **Git changes:** full-file diffs (uncommitted, or committed on the branch against its base) in a VS Code-like file
  tree, with "open in editor".
- **Browser:** an embedded browser per worktree with an element picker that captures selector, DOM context, styles and a
  screenshot for a comment.
- **Task board:** a local Jira-like board (columns, labels, priorities, Markdown descriptions); a card starts a new
  worktree and agent in one click and keeps a list of its agent sessions.
- **CLI and handoff:** a `pragma` command (worktrees, agents, tasks, comments) installed onto the PATH from Settings, and a
  handoff skill so one agent can pass work to another agent or worktree.
- **Look and feel:** dark and light modes with four palettes (VS Code, Indigo, Amber, Dark brown), density settings,
  command palette and keyboard shortcuts.
- **Packaging:** one command builds dmg/zip (macOS), AppImage/deb (Linux) and NSIS/zip (Windows) with an audit of
  native modules; a Homebrew cask for macOS.
- MIT license, app logo and icons.

[0.9.2]: https://github.com/pragmataW/pragma-ade/releases/tag/v0.9.2
[0.9.1]: https://github.com/pragmataW/pragma-ade/releases/tag/v0.9.1
[0.9.0]: https://github.com/pragmataW/pragma-ade/releases/tag/v0.9.0
