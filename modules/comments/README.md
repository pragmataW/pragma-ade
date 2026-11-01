# comments — `@pragma/module-comments`

The shared review-comment pipeline (phase 05): draft storage, batching, choosing the target agent session and delivering the comments into the agent. Editor (06), diff (07), browser (08) and chat (11c) plug into it.

- Manifest: id `comments`, `dependsOn: ["projects", "terminal", "agents"]`.
- Entries: `./contract` (anywhere), `./renderer` (the module itself; other renderers use `CommentsUiServiceToken`), `./main` (loader only).
- Table `comments_review_comments` (`migrations/0501_comments_review_comments.sql`; `0502_comments_drop_sent.sql` deleted old sent rows and dropped `status` / `target_session_id` / `sent_at`). Every stored comment is a draft: **a successful send deletes the delivered comments**; `needsTarget`, `noSession` (incl. the pending launch) and `failed` keep them. Comments of a removed worktree are deleted on `worktree.removed`.

## Main service — `CommentsServiceToken` (`comments.service`)

| Method | |
|---|---|
| `addDraft(input)` | Validates with `CommentInputSchema` (CRLF → LF, `\` → `/`, trimmed non-empty body), stores a draft, emits `comment.created`, publishes `comments.changed`. |
| `update(id, patch)` / `remove(id)` | `CommentsError` `notFound` (also for a comment already sent, since it was deleted). |
| `listDrafts(worktreeId)` | Oldest first; all of the worktree's comments. There is no sent list. |
| `resolveTarget(worktreeId, preferredSessionId?)` | `none` / `single` / `choose` over the running sessions; default = preferred, else last focused, else first. |
| `send(ids, targetSessionId?, { promptUser? })` | On `sent` the delivered comments are deleted (then `comment.sent` and `comments.changed`). Returns a `SendResult`: `sent`, `needsTarget`, `noSession` or `failed` (`errorKey` ∈ `SEND_ERROR_KEYS`, i18n via `sendErrorI18nKey`). Without a target it sends when exactly one session runs; otherwise, unless `promptUser === false`, it publishes `comments.sendRequested` and the drawer asks the user. Concurrent sends of the same ids are rejected with `alreadySending`. |
| `sendOnNextSession(worktreeId, ids)` / `cancelPending(worktreeId)` | Deliver to the next session started in that worktree (once its output went quiet; entries expire after 10 min); delivered comments are deleted, as with `send`. |
| `format(comments)` | The fixed English agent template (`Review comments:` + numbered items). |
| `registerDeliveryTarget(mode, deliver)` | Delivery by session **mode**, never by provider. 05 registers `terminal` (bracketed paste via `PtyService.paste`, refused with `agentNotReady` while the program has not enabled mode 2004; Enter after the paste while the `submitAfterPaste` setting is on (default)). Returns unregister; a duplicate mode throws. |

11c registers `chat`:

```ts
comments.registerDeliveryTarget('chat', async (req) => chat.appendToComposer(req.sessionId, req.text))
// req.comments holds the Comment DTOs (for chips); req.submit can be ignored.
```

Main-side callers without UI (06's editor bridge handler) call `service.addDraft(input)` and then `service.send([id])`; because `promptUser` defaults to true, the drawer asks for a target when one is needed.

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

- `ui.send(commentIds, { preferredSessionId? })` — the drawer's flow for comments a module created itself (07's "Send N comments to agent"): one agent → sent; several → target picker; none → "Start agent" suggestion. Resolves to the `SendResult`, or `undefined` while a dialog waits.
- `ui.openDrawer({ worktreeId?, preferredSessionId? })` — the drawer has a single drafts list (no tabs).

## Events, command, slots, settings

- Main bus: `comment.created` (`{ comment }`), `comment.sent` (`{ commentIds, sessionId, worktreeId, sentAt }`).
- Renderer IPC events: `comments.changed`, `comments.sendRequested`, `comments.pendingDelivered`.
- Command `comments.openDrawer` (renderer, palette), args `OpenDrawerArgsSchema`.
- Slots used: `agentSession.toolbar` (the **only** comments button: draft badge, prefers that session as target) and `titlebar.right` (`CommentsHost`: no visible UI, only keeps the drawer and both dialogs mounted). Without an agent session the drawer opens through the `comments.openDrawer` command or another module's `ui.openDrawer`.
- Settings › Comments (order 70): `submitAfterPaste` (default on; Enter follows the paste after `SUBMIT_DELAY_MS`).

## Testing

- `COMMENTS_TESTIDS` (`src/contract/testids.ts`) for other modules' E2E tests.
- Test hooks (`PRAGMA_TEST=1`): `globalThis.__pragmaCommentsTest.createDraft({ worktreeId, ...overrides })` and `.setPendingOptions({ readyQuietMs, readyTimeoutMs, ttlMs })`.
- `pnpm --filter @pragma/module-comments test` / `e2e`.
