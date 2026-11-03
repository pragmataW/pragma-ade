---
name: pragma-cli
description: >-
  Use Pragma ADE's `pragma` CLI to list and create worktrees, list and start agent sessions,
  manage board tasks, work through review threads (list, reply, resolve), and find a session's local transcript. Use when working
  inside Pragma ADE and the user mentions worktrees, agents, the task board or review comments, when a "Review round" message
  asks you to address review threads, or when the user asks to hand work to another agent (then use pragma-handoff).
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
| `pragma comments list [--worktree <id>] [--status <open\|resolved\|all>]` | Review threads of a worktree (default open) with every reply |
| `pragma comments show <id>` | One review thread |
| `pragma comments reply <id> [--body <text>] [--file <path\|->]` | Reply to a thread (pass exactly one of `--body`, `--file`) |
| `pragma comments resolve <id> [--body <text>]` | Mark a thread resolved, optionally with a closing reply |
| `pragma comments reopen <id>` | Reopen a resolved thread |
| `pragma handoff --to <profile> --file <path\|-> [--branch <name>] [--base <branch>] [--same-worktree] [--task <id>]` | Hand off to another agent |
| `pragma session locate <id>` | Where a session's full transcript is stored (Pragma, Claude or OpenCode session id) |
| `pragma session current` | The same for your own session (`PRAGMA_SESSION_ID`) |

- `--worktree` and `--project` default to the current worktree (`PRAGMA_WORKTREE_ID`, else
  the directory you are in).
- Task ids are the number (`42`) or the key (`PRA-42`); priorities are none, low, medium,
  high, urgent.
- `-` as a file reads from stdin.

## Review threads

The user reviews your work in Pragma (editor, diff, browser) and presses Send. You then get a
one-line message such as `Review round 2: 3 open review threads in this worktree …`. Each
comment is a thread; the user may answer your replies in later rounds.

1. `pragma comments list` (add `--json` for structured data). Each thread shows its id,
   status, source, `file:lines`, the code snippet or browser element, then the user's comment
   and every reply in order. Items new in this round are marked `(new in round N)`.
2. Fix what each thread asks for.
3. `pragma comments reply <id> --body "<what you changed>"`. For long replies write a file
   and pass `--file <path>`, or `--file -` to read stdin.
4. `pragma comments resolve <id>` for threads you fully addressed (add `--body` for a short
   closing note instead of a separate reply).

- Resolve only what you actually addressed. If you disagree, need input or did only part of
  it, reply explaining why and leave the thread open.
- Replying to a resolved thread is fine; use `pragma comments reopen <id>` if it needs more
  work.
- Do not re-list the whole review after every fix; `pragma comments show <id>` shows one
  thread.

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
  module_unavailable, conflict, internal)
- `2` usage error (bad flags)
- `3` Pragma ADE is not running or cannot be reached; ask the user to open the app

For handoffs (giving the work to another agent), use the pragma-handoff skill.
