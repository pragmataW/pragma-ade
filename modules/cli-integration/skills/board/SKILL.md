---
name: pragma-board
description: >-
  Work the tasks on Pragma ADE's task board column by column with the `pragma` CLI: read the
  live columns and their descriptions, and move each task to the right column before and after
  working on it. Use only when the user asks you to work the board, e.g. "do the todos on the
  board", "work the Todo column", "taskboarddaki todoları yap", "board'daki işleri yap". Not for
  creating or editing single tasks (use pragma-cli).
---

# Pragma board

The task board of a Pragma ADE project is a list of columns (for example Backlog, Todo,
In Progress, Review, Done). Each column can have a description written by the user that says
when a task belongs in it. This skill is the procedure for working through tasks on the board
with the `pragma` CLI (see the pragma-cli skill for every command). If `pragma` is not found,
use `"$PRAGMA_CLI"`.

## When to use

- Only when the user explicitly asks you to work (some of) the board, e.g. "do the todos on the
  board" or a named column or task.
- Work only the tasks the user asked about. Never move, start or edit any other task.

## Read the board live

1. `pragma task columns --json` lists the columns in board order with `id`, `name`,
   `description` and `taskCount`. The board order is the workflow order (left to right).
2. `pragma task list --column <name> --json` lists the tasks of the column the user named
   ("todos" means the column named like Todo). Work them in the order printed.
3. Never rely on earlier output: the user may add, rename or describe columns while you work.

## For each task, one at a time

1. `pragma task show <id> --json`: read the title and the description. The description is the
   spec; its checklist is what done means.
2. Re-run `pragma task columns --json` and choose the column for started work from the names
   and descriptions (usually In Progress).
3. `pragma task move <id> --column <name>` before you start working on it.
4. Do the work. If the task is unclear, ask the user before guessing.
5. Re-run `pragma task columns --json` and choose the column for finished work:
   - If a column's description says finished work needs review (for example Review), move the
     task there, never to Done.
   - Move to Done only when no review column applies or a description says you may.
6. `pragma task move <id> --column <name>`.
7. Tell the user what you did, then continue with the next task.

## When no column fits

If no column clearly matches the started or finished state, stop and ask the user which column
to use. Do not guess, do not create or rename columns and do not edit column descriptions.

## Rules

- If you could not finish a task, leave it in its started column and tell the user why.
- A `not_found` error for `--column` lists the current columns: re-read them and decide again.
- Exit code `3` means Pragma ADE is not running; ask the user to open the app.
