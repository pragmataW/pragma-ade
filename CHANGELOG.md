# Changelog

All notable changes to Pragma ADE are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.9.1] - 2026-11-02

### Fixed

- **Linux:** the editor stayed on "Starting editor…" and no terminal opened when the login shell's rc file starts
  another interactive shell (for example a `.bashrc` that runs `zsh`). Reading the shell environment now gives the
  shell an empty stdin and, on timeout, kills the whole process group and falls back to the app environment.

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

[0.9.1]: https://github.com/pragmataW/pragma-ade/releases/tag/v0.9.1
[0.9.0]: https://github.com/pragmataW/pragma-ade/releases/tag/v0.9.0
