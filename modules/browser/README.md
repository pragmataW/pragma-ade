# browser — `@pragma/module-browser`

Phase 08. The active worktree's running app in the right panel (one `WebContentsView` per tab, cookies partitioned per
worktree) and an element picker that sends the picked element to the agent through the comments pipeline (05).

- Manifest: id `browser`, `dependsOn: ["projects"]`, `optionalDependsOn: ["comments"]` (without comments the browser
  works and the Pick button is disabled with a hint).
- Entries: `./contract` (anywhere), `./main` and `./renderer` (loader only).

## UI

- Right-panel tab `browser` (order 20, icon `globe`): tab strip (turns into the picker banner while armed), toolbar
  (back/forward/reload-stop, address bar with a green dot for local dev servers, Pick element, zoom −/%/+, DevTools)
  and the area the page view covers. Both rows are fixed (`TAB_STRIP_PX` 28 + `TOOLBAR_PX` 32 = `VIEW_INSET_TOP_PX`),
  which is the attach-time `inset.top`.
- Address bar: a port (`3000`, `:5173/app`), a local host (`localhost:8080`, `127.0.0.1:4000`, `[::1]:3000`), a domain
  (`example.com/docs` → https) or a search (`searchUrl`). A port-only input offers `Open http://localhost:<port>/`.
- `statusbar.right` item `browser.devUrl` (order 30): `host:port` of the active tab while it shows a local dev
  server; click opens the Browser tab.
- Settings › Browser (order 90).
- After a pick the page is frozen (SDK `nativeViews.freeze`) and 05's `<CommentComposer>` opens in `@pragma/ui`
  `AnchoredPopover` (guard `snapshot`) next to the element, with "Attach screenshot and computed styles" and
  "Include console errors (n)" toggles. Done/Esc dismisses (unfreeze).

## Commands, IPC, events

| Kind | Name | Payload |
|---|---|---|
| command (main) | `browser.open` | `{ worktreeId?, url }` → opens a tab (active worktree by default) and reveals the panel |
| command (main, palette) | `browser.togglePicker` | arms/cancels the picker on the active tab (no-op without comments) |
| IPC | `browser.getSnapshot` | `{}` → `BrowserSnapshot` |
| IPC | `browser.openTab` | `{ worktreeId?, url? }` → `{ tabId }` (only `http(s)`/`about:blank`) |
| IPC | `browser.closeTab`, `browser.activateTab` | `{ tabId }` |
| IPC | `browser.navigate` | `{ tabId, input }` → `{ url }` |
| IPC | `browser.history` | `{ tabId, action: back/forward/reload/stop }` |
| IPC | `browser.toggleDevTools` | `{ tabId }` → `{ open }` |
| IPC | `browser.zoom` | `{ tabId, action: in/out/reset }` → `{ zoomFactor }` |
| IPC | `browser.picker.start`, `browser.picker.cancel` | `{ tabId }` |
| IPC | `browser.pick.dismiss` | `{ pickId }` |
| event | `browser.snapshot` | `BrowserSnapshot` (coalesced per microtask) |
| event | `browser.picked` | `BrowserPick` |
| event | `browser.pickCancelled` | `{ tabId, reason: user/navigation/destroyed/timeout/error }` |
| event | `browser.focusAddressBar` | `{ tabId }` |

Errors are `BrowserError` (`tabNotFound`, `invalidInput`, `noWorktree`, `pickNotFound`); over IPC the message starts
with the code. Events consumed: projects `worktree.selected` (shows that worktree's tabs) and `worktree.removed`
(closes its tabs and clears its partition).

## Settings (`browser` section)

| Key | Default | |
|---|---|---|
| `searchUrl` | `https://duckduckgo.com/?q={query}` | `{query}` is replaced |
| `consoleBufferSize` | 200 | console messages kept per tab (ring buffer) |
| `consoleErrorsInComment` | 10 | last N console errors attached to a comment |
| `outerHtmlMaxChars` | 2000 | outerHTML clamp (05's formatter cuts at 2000 too) |
| `textMaxChars` | 200 | text clamp |
| `styleProps` | display, position, width, height, margin, padding, color, background-color, font-family, font-size, font-weight, line-height, border, border-radius, gap, opacity | computed styles collected |
| `maxLiveViews` | 6 | tabs kept loaded; the least recently shown hidden ones are discarded and reloaded on activation |
| `screenshotRetentionDays` | 7 | element screenshots (`<userData>/tmp/shots/<pickId>.png`) older than this are deleted on start |
| `reactProbe` | true | detect the React component and source of the picked element |

## Shortcuts

App scope (renderer): `CmdOrCtrl+Shift+C` → `browser.togglePicker`. Inside a page (`before-input-event`, matched with
the SDK's `matchShortcut`): `CmdOrCtrl+Shift+C` picker, `CmdOrCtrl+L` focus address bar, `CmdOrCtrl+R`/`F5` reload,
`CmdOrCtrl+Alt+I`/`F12` DevTools, `CmdOrCtrl+=`/`CmdOrCtrl+Plus` zoom in, `CmdOrCtrl+-` zoom out, `CmdOrCtrl+0` reset.

## Security model

- Partition per worktree: `persist:wt-<worktreeId>` (unsafe characters → `_`); removing a worktree clears its storage
  and cache.
- Guests: `sandbox`, `contextIsolation`, no `nodeIntegration`, `webSecurity`, `safeDialogs`, no preload.
- Permissions: everything is denied except `fullscreen` and `clipboard-sanitized-write`.
- Schemes: `http:`, `https:` and `about:blank` load in-app. Denylisted schemes (`file:`, `javascript:`, `data:`,
  `blob:`, `chrome:`, `devtools:`, `view-source:`, `filesystem:`, other `about:`, Chrome's `kDeniedSchemes`; list
  adapted from Orca) are blocked in `will-navigate`, `will-redirect` and `will-frame-navigate` and never reach the OS.
  Other schemes from the main frame or `window.open` go to `ctx.shell.openExternal`, at most once per tab per second;
  subframes never open external apps. `window.open` of web URLs opens a new tab.
- The picker overlay and its event capture run only in isolated world 1808 (`executeJavaScriptInIsolatedWorld`); the
  page cannot see `__pragmaPicker`. The only main-world code is the read-only React probe (fiber expandos are not
  visible to isolated worlds); its result is untrusted.
- Every value from the page is validated and clamped with zod in main; outerHTML has password/hidden input values
  and `data-*token|secret|auth|key|password|session*` attributes redacted; the URL loses userinfo and fragment and
  sensitive query values (`token`, `code`, `key`, `session`, …) are replaced with `[redacted]`.

## Testing

- `BROWSER_TEST_IDS` / `BROWSER_DATA_ATTRS` (`src/contract/testids.ts`) for other modules' E2E tests.
- Test hooks (`PRAGMA_TEST=1`): `globalThis.__pragmaBrowserTest` — `snapshot()`, `evalMain(tabId, code)` (user
  gesture), `evalPicker(tabId, code)` (isolated world), `sendInput(tabId, events)`, `isViewVisible(tabId)`,
  `isDevToolsOpened(tabId)`, `partitionOf(tabId)`, `freeze/unfreeze(tabId)`, `externalOpens` (external opens are
  recorded instead of performed).
- `pnpm --filter @pragma/module-browser test` / `e2e` (the E2E needs `node scripts/build-e2e.ts` first, as root
  `pnpm e2e` does).

## Upstream API notes

Names the plan used, checked against the merged code (Task 1).

| Plan name | Real name / note |
|---|---|
| `ctx.nativeViews.attach(viewId, view, { panelTabId, inset })` → `Disposable` | Same; `freeze`/`unfreeze` return `Promise<void>`. |
| `ctx.ipc.publish`, `ctx.settings.get/onChange/update` | Same. |
| `ctx.shell.openExternal(url)` | Same, but the SDK accepts only `http:`, `https:` and `mailto:` (throws `UnsupportedUrlError` otherwise). |
| `ctx.shortcuts.register({ id, accelerator, scope, command })` | Same (`ShortcutSpec`). |
| `RingBuffer`, `matchShortcut(event, accelerator, platform)` | `@pragma/sdk` (common). |
| `ShellSlots.statusbarRight`, `SETTINGS_PAGE_ORDER.browser` (90) | `@pragma/sdk`. |
| `ctx.panels.activateRightTab`, `ctx.settingsPages.register` | Same. |
| `useT('browser')`, `useModuleSettings` | `@pragma/sdk/renderer`. |
| `@pragma/ui` `AnchoredPopover` (guard `snapshot`) | `@pragma/ui/components/anchored-popover`; props `rect, open, onOpenChange, placement?, guardMode?`. |
| `@pragma/ui` Checkbox | Not in `@pragma/ui` (see Contract gaps). |
| `startStaticServer` | `@pragma/test-support` → `{ url, port, close }`, `url` has no trailing slash. |
| `launchApp({ disabledModules })` | `@pragma/test-support/e2e`. |
| Projects events | `worktreeSelected` `{ worktreeId, previousWorktreeId }`, `worktreeRemoved` `{ worktreeId, projectId, path, reason }`, `ProjectsServiceToken.getActiveWorktreeId()`. |
| Comments | `BrowserElementContextSchema`, `CommentsUiServiceToken`, test ids `COMMENTS_TESTIDS` (`composer: 'comment-composer'`). |
| Agents testing | `createFakeAgentProfile(hooks, opts)`, `waitForFakeAgentLog(path, predicate)`, `readFakeAgentLog`, `FAKE_AGENT_ENV`. |
| Project/worktree setup in E2E | No test-support helper; specs use `projectsIpc.addProject`/`getState`/`selectWorktree` through `invokeIpc` (as 05 does). |
| Test hooks | `defineTestHooks` from `@pragma/sdk/main`; reached with `app.evaluate` on `globalThis.__pragmaBrowserTest`. |

## Contract gaps

- `ctx.nativeViews` has no state accessor; the test hook reads `WebContentsView.getVisible()` directly.
- `ctx.shell.openExternal` refuses schemes other than `http:`/`https:`/`mailto:`, so custom app schemes (`zoommtg:`,
  `vscode:`) classified "external" are logged and dropped instead of opening the OS handler.
- `@pragma/ui` has no `Checkbox`; the pick popover uses a native `<input type="checkbox">` styled with tokens.
- The shell renderer CSP (`img-src 'self' data:`) blocks remote favicons, so tabs show a generic globe icon
  (`faviconUrl` is still in the snapshot).
- Playwright window screenshots do not include native views; the E2E freezes the view (SDK snapshot image) before
  screenshots, so the hover box of an armed picker is not visible in them.
