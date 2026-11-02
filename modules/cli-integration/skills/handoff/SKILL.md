---
name: pragma-handoff
description: >-
  Hand off the current work to another agent (for example Claude Code or OpenCode) through
  Pragma ADE's `pragma` CLI, in a new worktree or the same one. Use when the user says
  "hand off", "handoff", "handover", "give this to another agent", "let OpenCode/Claude
  continue", "devret", or asks to move the work to another agent or worktree. Not for asking
  another agent something and waiting for the answer.
license: MIT. Portions adapted from stablyai/orca (Copyright (c) 2026 Lovecast Inc.).
---

# Pragma handoff

A handoff transfers ownership of the current task to another agent. After a successful
handoff you stop working on the task. If the user wants the result back ("have another
agent review this and tell me"), this is not a handoff: say so and ask how to proceed.

## Before you start

1. Run `pragma --version`. If `pragma` is not found, run `"$PRAGMA_CLI" --version` and use
   `"$PRAGMA_CLI"` instead of `pragma` below. If neither works, tell the user to enable the
   CLI in Pragma ADE (Settings > Command line) and stop. Do not fall back to raw
   `git worktree` commands.
2. Pick the target profile: run `pragma agent profiles --json` and use the `name` or `id` of
   the profile the user asked for (names match case-insensitively, e.g. `--to opencode`).
3. Decide where the next agent works:
   - Default: a new worktree branched from your current branch. It sees committed work only.
     If uncommitted changes matter, ask the user whether to commit them first.
   - `--same-worktree`: the next agent works in this worktree and sees uncommitted changes.
     Use it when the user asks, or when committing is not appropriate. Stop editing files
     once you hand off.
4. If the work belongs to a board task, find its id with `pragma task list --json` and pass
   `--task <id>`; Pragma links the new session and moves the card to In Progress.

## Write the handoff document

Write it to a temporary file outside the repository (for example
`${TMPDIR:-/tmp}/pragma-handoff-<short-name>.md`). Be concrete; the next agent has none of
your context. Use this template:

```markdown
# <One-line title of the task>

## Goal
What the user wants and why. Acceptance criteria if known.

## Done so far
What you changed and decided, with commit hashes if any.

## Remaining work
Ordered list of the next steps.

## Relevant files
Paths (with line numbers where useful) and what each one is for.

## Open questions
Anything undecided or blocked, and who can answer it.

## How to verify
Exact commands to run and what passing looks like.

## Branch and worktree
Current branch, base branch, whether changes are committed, worktree path.
```

## Hand off

```text
pragma handoff --to <profile> --file <path-to-handoff.md> [--task <id>] [--branch <name>] [--same-worktree] --json
```

- Omit `--branch` to let Pragma name it `handoff/<title>-<timestamp>`. Use `--base <branch>`
  only if the user asked for a different base.
- Pragma adds the path of your full session transcript to the next agent's prompt, so the
  handoff document can stay a summary; still put every decision and next step in it.
- The handoff is done when the command returns `"ok": true`. Report to the user the target
  profile, branch, worktree path and session id from `result`. Do not wait for the other
  agent to finish, and do not keep working on the task.
- If the command fails, report its exact error. If it says Pragma ADE is not running, ask the
  user to open the app. If a worktree was created but the agent did not start, tell the user
  the worktree name from the error instead of retrying blindly.
