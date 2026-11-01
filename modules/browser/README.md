# browser — `@pragma/module-browser`

Phase 08. The active worktree's running app in the right panel (one `WebContentsView` per tab, cookies partitioned per
worktree) and an element picker that sends the picked element to the agent through the comments pipeline (05).

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
