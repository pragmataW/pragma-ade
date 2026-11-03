---
name: pragma-cli
description: >-
  Use Pragma ADE's `pragma` CLI to list and create worktrees, list and start agent sessions,
  manage board tasks, read review comments, and find a session's local transcript. Use when working inside Pragma ADE and the user
  mentions worktrees, agents, the task board or review comments, or asks to hand work to
  another agent (then use pragma-handoff) or explicitly asks to consult another agent (then
  use pragma-ask).
---

# Pragma CLI

`pragma` talks to the running Pragma ADE app. Agents started by Pragma always have it on
`PATH`. If `pragma` is not found, use `"$PRAGMA_CLI"` instead; if neither works, tell the
user to enable the CLI in Pragma ADE (Settings > Command line).

Prefer `--json`: every command then prints one JSON document,
`{"ok":true,"result":…}` or `{"ok":false,"error":{"code":…,"message":…}}`.

## Commands

| Command | What it does |
|---|---|
| `pragma worktree list [--project <id>]` | Worktrees of a project (`*` marks the main one) |
| `pragma worktree create --branch <name> [--base <branch>] [--project <id>] [--path <dir>]` | New worktree |
| `pragma agent list [--worktree <id>]` | Agent sessions of a worktree |
| `pragma agent spawn --profile <id\|name> [--worktree <id>] [--prompt-file <path>]` | Start an agent |
| `pragma agent profiles` | Agent profiles (names match case-insensitively) |
| `pragma task list [--project <id>] [--column <name>]` | Board tasks |
| `pragma task create --title <t> [--description-file <path>] [--column <name>] [--priority <p>] [--labels a,b] [--project <id>]` | New task |
| `pragma task update <id> [--title <t>] [--description-file <path>] [--priority <p>] [--labels a,b]` | Edit a task |
| `pragma task move <id> --column <name>` | Move a task to another column |
| `pragma task columns [--project <id>]` | Board columns in order with their description and task count |
| `pragma task show <id>` | One task in full: column, priority, labels, worktree, description |
| `pragma comments list [--worktree <id>]` | Review comments (drafts) of a worktree |
| `pragma handoff --to <profile> --file <path\|-> [--branch <name>] [--base <branch>] [--same-worktree] [--task <id>]` | Hand off to another agent |
| `pragma session locate <id>` | Where a session's full transcript is stored (Pragma, Claude or OpenCode session id) |
| `pragma session current` | The same for your own session (`PRAGMA_SESSION_ID`) |
| `pragma ask --to <profile> (--prompt <text> \| --prompt-file <path\|->) [--timeout <seconds>]` | Ask another agent and wait for its answer (only when the user asks; see pragma-ask) |

- `--worktree` and `--project` default to the current worktree (`PRAGMA_WORKTREE_ID`, else
  the directory you are in).
- Task ids are the number (`42`) or the key (`PRA-42`); priorities are none, low, medium,
  high, urgent.
- `-` as a file reads from stdin.

## Session transcripts

Every Claude Code and OpenCode session is stored on this machine. `pragma session locate <id>`
prints the provider, the transcript `path`, its `format` and the session's `cwd`:

- Claude Code: `path` is a JSONL file (one JSON event per line); read it directly. `related`
  lists subagent transcripts.
- OpenCode: `path` is its SQLite database; run the printed `read` command
  (`opencode session export <id>`) to get the transcript as JSON.

The id can be a Pragma session id (`pragma agent list` shows both it and the provider session
id), a Claude session id or an OpenCode session id (`ses_…`); sessions started outside Pragma
are found too. Inside a Pragma agent, `pragma session current` needs no id. Your own provider
session id is also in the environment: Claude Code sets `CLAUDE_CODE_SESSION_ID`.

## Exit codes

- `0` ok
- `1` the app reported an error (`error.code`: invalid_argument, not_found, ambiguous,
  module_unavailable, conflict, internal, timeout)
- `2` usage error (bad flags)
- `3` Pragma ADE is not running or cannot be reached; ask the user to open the app

For handoffs (giving the work to another agent), use the pragma-handoff skill. To consult
another agent when the user asks for it, use the pragma-ask skill. To work through the board's
tasks column by column, use the pragma-board skill.
