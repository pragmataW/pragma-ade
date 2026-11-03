# comments — `@pragma/module-comments`

The shared review pipeline (phase 05, review threads since 2026-11-03): review threads with replies, review rounds, choosing the target agent session and nudging the agent to read the threads with the `pragma` CLI. Editor (06), diff (07), browser (08), chat (11c) and the CLI (cli-integration) plug into it; every surface shows the same threads.

- Manifest: id `comments`, `dependsOn: ["projects", "terminal", "agents"]`.
- Entries: `./contract` (anywhere), `./renderer` (the module itself; other renderers use `CommentsUiServiceToken`), `./main` (loader only).
- Tables: `comments_review_comments` (thread roots; `0501`, `0502`, and `0503_comments_threads.sql` adds `status` open|resolved, `round`, `resolved_at`), `comments_review_replies` (`ON DELETE CASCADE` from the root; `author` user|agent, `session_id`, `author_label`, `round`) and `comments_review_rounds` (`last_round` per worktree). Everything of a removed worktree is deleted on `worktree.removed`.

### Review threads (decisions)

1. **Thread model.** A comment row is a thread root with `status`, `resolvedAt` and `round` (absent = **pending**, not delivered yet). Replies are ordered by `createdAt`. Agent replies get the worktree's current round (never pending); user replies are pending until a Send.
2. **Rounds.** A successful Send runs one transaction: `round = lastRound + 1`, stamping only the pending ids captured before delivery (items written meanwhile stay pending). A failed or unconfirmed delivery changes nothing. Nothing pending → `failed: empty`.
3. **Send** always delivers every pending item of the worktree (new roots and user replies). Per-id sends and the drawer selection are gone. The composer's "Send now" adds the draft, then sends the round.
4. **The nudge** is one fixed-English line (no bracketed-paste wait), e.g. ``Review round 2: 3 open review threads in this worktree (1 new, 2 with new replies). Read them with `pragma comments list`, …``. Comments are never pasted in full and never deleted by a Send.
5. **Reopen.** A user reply reopens a resolved thread; at Send every thread with a pending user reply is reopened (covers an agent resolving it in between).
6. **Edit only while pending.** A delivered root cannot be edited (`alreadyDelivered`; reply instead). Deleting a thread works any time.
7. **What agents see.** `listThreads(…, { deliveredOnly: true })` / `visibleToAgent`: delivered roots with delivered replies only; drafts stay private until Send.
8. **Formatting.** `format(threads, { round })` renders each thread (fixed English: head `[open] <id> \`file:lines\` (source)`, snippet or element block, `User:` / agent label lines, `(new in round N)` marks); the CLI prints it.
9. **Where threads show.** Diff and editor show code threads (`isCodeThread`: editor comments, and diff comments on the new side; old-side diff threads only in the diff); browser threads in the drawer and the CLI. Resolved threads start collapsed everywhere.
10. **Badges.** The toolbar badge counts pending items; 07's tree marker counts open code threads per file.
11. **Follow-up:** the nudge assumes the `pragma` CLI is on the agent's `PATH` (cli-integration enabled).

## Main service — `CommentsServiceToken` (`comments.service`)

| Method | |
|---|---|
| `addDraft(input)` | Validates with `CommentInputSchema` (CRLF → LF, `\` → `/`, trimmed non-empty body), stores a draft, emits `comment.created`, publishes `comments.changed`. |
| `update(id, patch)` / `remove(id)` | `CommentsError` `notFound`; `update` of a delivered root → `alreadyDelivered`. `remove` deletes the whole thread. |
| `listThreads(worktreeId, { status?, deliveredOnly? })` / `getThread(id)` | Oldest first, replies included; `status` open / resolved / all (default all). |
| `reply(id, { body, author, sessionId?, authorLabel? })` / `removeReply(replyId)` | A user reply is pending and reopens a resolved thread; an agent reply carries the current round. Only a pending user reply can be removed. Emits `comment.replied`. |
| `setStatus(id, status, reply?)` / `clearResolved(worktreeId)` / `round(worktreeId)` | Resolve / reopen (optional closing reply first; emits `comment.statusChanged`); delete resolved threads (returns the count); the last delivered round (0 before the first). |
| `resolveTarget(worktreeId, preferredSessionId?)` | `none` / `single` / `choose` over the running sessions; default = preferred, else last focused, else first. |
| `send(worktreeId, targetSessionId?, { promptUser? })` | Delivers the worktree's review round (see above); on `sent` → `comment.sent` (`{ round, commentIds, replyIds, sessionId, worktreeId, sentAt }`) and `comments.changed`. Returns a `SendResult`: `sent` (`round`, `commentIds`, `replyIds`), `needsTarget`, `noSession` or `failed` (`errorKey` ∈ `SEND_ERROR_KEYS`, i18n via `sendErrorI18nKey`). Without a target it sends when exactly one session runs; otherwise, unless `promptUser === false`, it publishes `comments.sendRequested` and the drawer asks the user. A second Send of the same worktree while one runs → `alreadySending`. |
| `sendOnNextSession(worktreeId)` / `cancelPending(worktreeId)` | Deliver the round (what is pending then) to the next session started in that worktree (once its output went quiet; entries expire after 10 min). |
| `format(threads, { round })` | Fixed-English rendering of threads for agents (CLI output). |
| `registerDeliveryTarget(mode, deliver)` | Delivery by session **mode**, never by provider. 05 registers `terminal` (bracketed paste via `PtyService.paste`, refused with `agentNotReady` while the program has not enabled mode 2004; Enter after the paste while the `submitAfterPaste` setting is on (default)). Returns unregister; a duplicate mode throws. |

11c registers `chat`:

```ts
comments.registerDeliveryTarget('chat', async (req) => chat.appendToComposer(req.sessionId, req.text))
// req.text is the one-line nudge, req.round the round, req.comments the threads with something new (for chips);
// req.submit can be ignored.
```

Main-side callers without UI (06's editor bridge handler) call `service.addDraft(input)` / `service.reply(…)` and then `service.send(worktreeId)`; because `promptUser` defaults to true, the drawer asks for a target when one is needed.

## Renderer service — `CommentsUiServiceToken` (`comments.ui`)

Add `"comments"` to `dependsOn` (or `optionalDependsOn` and use `ctx.services.tryGet`), then:

```tsx
const ui = ctx.services.get(CommentsUiServiceToken)
<ui.CommentComposer
  worktreeId={worktreeId}
  context={{ source: 'diff', filePath, lineStart, lineEnd, diffSide, snippet, language }}
  onDone={(r) => closePopover()}   // r.kind: drafted | sent | saved | cancelled
/>
// 08: context={{ source: 'browser', element }}  (BrowserElementContext; outerHTML is cut at 2000 chars when formatted)
```

- `ui.send({ worktreeId?, preferredSessionId? })` — the drawer's flow (07's "Send N to agent"): delivers the worktree's round; one agent → sent; several → target picker; none → "Start agent" suggestion. Resolves to the `SendResult`, or `undefined` while a dialog waits.
- `ui.ThreadView` (`ThreadViewProps`: `comment`, `leading?`, `locationLabel?`, `onEdit?`, `surface?`) — one thread with replies, author badges (You / agent label / Agent), Pending and Open/Resolved badges, reply box (⌘/Ctrl+Enter, Esc), Resolve / Reopen / Delete, and Edit (pending root, host's flow). 07's diff cards use it.
- `ui.clearResolved(worktreeId)` — SDK confirm dialog, then deletes the resolved threads; resolves to the count.
- `ui.openDrawer({ worktreeId?, preferredSessionId? })` — open threads, a collapsed "Resolved (n)" section, Clear resolved, and the "Send N pending items" footer.

## Events, command, slots, settings

- Main bus: `comment.created` (`{ comment }`), `comment.sent` (`{ round, commentIds, replyIds, sessionId, worktreeId, sentAt }`), `comment.replied` (`{ comment, reply }`), `comment.statusChanged` (`{ comment }`), `comment.changed` (`{ worktreeId }`, the generic live-update signal).
- Renderer IPC channels: `comments.list` (`{ round, threads }`), `reply`, `removeReply`, `setStatus`, `clearResolved`, `send` (`{ worktreeId, targetSessionId? }`), `sendOnNextSession` (`{ worktreeId }`), …
- Renderer IPC events: `comments.changed`, `comments.sendRequested`, `comments.pendingDelivered`.
- Command `comments.openDrawer` (renderer, palette), args `OpenDrawerArgsSchema`.
- Slots used: `agentSession.toolbar` (the **only** comments button: pending-items badge, prefers that session as target) and `titlebar.right` (`CommentsHost`: no visible UI, only keeps the drawer and both dialogs mounted). Without an agent session the drawer opens through the `comments.openDrawer` command or another module's `ui.openDrawer`.
- Settings › Comments (order 70): `submitAfterPaste` (default on; Enter follows the paste after `SUBMIT_DELAY_MS`).

## Testing

- `COMMENTS_TESTIDS` (`src/contract/testids.ts`) for other modules' E2E tests.
- Test hooks (`PRAGMA_TEST=1`): `globalThis.__pragmaCommentsTest.createDraft({ worktreeId, ...overrides })`, `.setPendingOptions({ readyQuietMs, readyTimeoutMs, ttlMs })`, `.agentReply(id, body, label?)`, `.setStatus(id, status)`, `.listThreads(worktreeId)`.
- Builders for other modules' unit tests: `@pragma/module-comments/testing` (`aThread`, `aReply`).
- `pnpm --filter @pragma/module-comments test` / `e2e`.
