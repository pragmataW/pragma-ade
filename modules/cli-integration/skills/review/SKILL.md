---
name: pragma-review
description: >-
  Address the review threads the user left in Pragma ADE (editor, diff and browser comments)
  with the `pragma` CLI: implement what is asked, resolve finished threads, and ask in the thread
  when a decision is needed. Use when a "Review round N" message from Pragma arrives, or when the
  user asks to handle the review or the comments, e.g. "address the review comments", "handle
  the review", "yorumlara bak", "review'ı ele al". For the command reference see pragma-cli.
---

# Pragma review

The user reviews your work in Pragma ADE (editor, diff, browser) and leaves comments. Each
comment is a thread with a status (open or resolved) and replies from the user and from agents.
When the user presses Send you get a one-line message such as `Review round 2: 3 open review
threads in this worktree …`. This skill is the procedure for working through those threads with
the `pragma` CLI (see the pragma-cli skill for every command). If `pragma` is not found, use
`"$PRAGMA_CLI"`.

## When to use

- A "Review round N" message from Pragma arrives.
- The user asks you to address the review or the comments.
- The user's own instructions win over the defaults below (for example "only reply, do not
  change code" or "resolve nothing").

## Read the threads

1. `pragma comments list` (add `--json` for structured data) prints the open threads of the
   current worktree. Each shows its id, status, source, `file:lines`, the code snippet or
   browser element, the user's comment and every reply in order. Items new in this round are
   marked `(new in round N)`.
2. `pragma comments show <id>` prints one thread in full.
3. Read every open thread, including earlier replies, before you change any code. A later
   reply from the user can change what an earlier comment asked for.

## Decide per thread

| Thread | What to do |
|---|---|
| Clear change request | Implement it, then `pragma comments resolve <id>`. Do not reply to every thread. Add `--body "<one line>"` only when the change is not obvious from the diff. |
| Needs a decision, is ambiguous, or you disagree | Do not guess. `pragma comments reply <id> --body "<concrete question, or options A/B>"` and leave it open. Continue with the other threads. |
| Asks for an explanation | Answer with `pragma comments reply <id> --body "<answer>"`. Resolve it only if nothing else is asked. |
| Partly done | Reply with what is left and why, and leave it open. |

For long text write a file and pass `--file <path>`, or `--file -` to read stdin.

## Rules

- Never resolve a thread you did not address, and never delete threads (there is no delete
  command).
- Change only what the threads ask for; do not refactor unrelated code.
- Do not re-list the whole review after every fix; use `pragma comments show <id>`.
- If a resolved thread needs more work, `pragma comments reopen <id>`.
- Exit code `3` means Pragma ADE is not running; ask the user to open the app.

## Finish

End with a short summary in the session:

- Implemented and resolved: one line per thread id.
- Waiting for your decision: each thread id with its question.
- Answered: thread ids you replied to with an explanation.

For every `pragma` command see the pragma-cli skill. To hand the remaining work to another
agent, use the pragma-handoff skill.
