# editor — `@pragma/module-editor`

Phase 06. The right-panel **Files** tab is a real VS Code workbench: VSCodium `reh-web` (pinned 1.143.17232, VS Code
1.143.1) served on `127.0.0.1` and shown in one `WebContentsView` per worktree. The bundled VS Code extension
`pragma-bridge` (sub-package `packages/bridge-extension`) talks to the app over 04's bridge: line comments and
review threads, open a file at a line, follow the app theme, report language status.

- Manifest: id `editor`, `dependsOn: ["projects", "bridge", "comments"]`, `core: false`.
- Entries: `./contract` (anywhere), `./main` and `./renderer` (loader only).
- Upstream calls go through `src/main/upstream.ts` only (projects, bridge, comments services).

## Provided

| Kind | Name | Notes |
|---|---|---|
| Service | `EditorServiceToken` (`editor.service`) | `openFile({ worktreeId, path, line?, column? })` → `{ ok } \| { ok:false, errorKey }`, `setTheme(mode, palette?)`, `getStatus()` |
| Command | `editor.openFile` | Same args (`OpenFileArgsSchema`). Starts the server if needed, selects the worktree (`projects.selectWorktree`), activates the Files tab, opens the file at line/column. |
| Right tab | `files` (order 30, icon `file-code`) | Download/progress/cancel/retry UI until ready; then the native view covers it. |
| Settings page | `editor` (order 80) | Max open views, theme map, palette sync, local webviews, server info, Restart / Re-download. |
| Status bar | `statusbar.right` `editor.languageStatus` (order 30) | `typescript · ✓` or `typescript · 1 error, 0 warnings` for the active worktree. |
| Bridge namespace | `editor` (`editorBridge`) | requests `hello`, `comment`, `testResponse`, `languageStatus`, `threads`, `reply`, `setStatus`, `deleteThread`, `send`; events `openFile`, `openDiff`, `setTheme` (broadcast), `testRequest`, `threads` |
| IPC | `editor.getStatus`, `ensureReady`, `cancelDownload`, `retry`, `restartServer`, `reinstall`, `getServerInfo`, `getLanguageStatus`; events `editor.statusChanged`, `revealRequested`, `languageStatusChanged` | |
| Test ids | `EDITOR_TEST_IDS` (contract) | For other modules' E2E. |

## Settings (`settings.json` → `editor`)

`maxOpenViews` (1–16, default 4, LRU), `themeMap` (`{ dark: 'Dark Modern', light: 'Light Modern' }`), `syncPalette`
(push the app palette of both modes into `workbench.colorCustomizations`, one `[<theme>]` block per `themeMap` theme
so the active theme always gets its own palette; only Pragma-managed keys; applies are serialized, newest wins, and
read back until they hold), `serveWebviewsLocally`
(serve `*.vscode-cdn.net/…/webview/browser/pre/*` from the local server), `reconnectionGraceSeconds` (300).

The mode itself is not written per switch: `themeMap` becomes `workbench.preferredDark/LightColorTheme` with
`window.autoDetectColorScheme`, and every view's `prefers-color-scheme` follows the app mode
(`nativeTheme.themeSource`), so hidden, loading and reloading workbenches flip at once; views are painted in the app
background (`bg`) before their page paints. `setTheme(mode)` overrides pin `colorTheme`.

## Server

- `<userData>/editor/<version>` (marker `.pragma-installed.json`, written last after an atomic rename), `downloads/`,
  `server/`, `data/`, `extensions/`, `state.json` (stable port: the workbench keeps user settings in IndexedDB per
  origin), `connection-token` (0600, new per start, passed with `--connection-token-file`), `bridge-extension.json`.
- Started lazily (first Files tab or `editor.openFile`), env = process env + SDK login-shell env + `PRAGMA_BRIDGE_URL/TOKEN`.
- Health probe on `/version`, backoff restart (1/2/4 s, at most 3 crashes per minute), whole process group killed on
  quit (plus a synchronous kill on process `exit`). Stdout is logged with `tkn=` redacted.

## Bumping the reh-web version

Edit `PINNED_VERSION` and the asset table in `src/main/release/release.ts`: file names, sha256 and size from
`gh api repos/VSCodium/vscodium/releases/tags/<tag> --jq '.assets[]|select(.name|test("reh-web"))|{name,digest,size}'`.
Check the archive layout (`stripComponents`, `bin/codium-server`) and the theme ids.

## Bridge extension

`packages/bridge-extension` (`pragma-bridge`, publisher `pragma`): `pragma.build: "build:vsix"` → esbuild bundle +
`dist/pragma-bridge.vsix` (packed with yazl, fixed timestamps) + `dist/manifest.json { version, sha256 }`. Packaged
through `pragma.package.extraResources` (`packages/bridge-extension/dist` → `resources/modules/editor/packages/bridge-extension/dist/`)
and found with `ctx.paths.resource('editor', 'packages/bridge-extension/dist/pragma-bridge.vsix')`. Installed with
`--install-extension --force` when the marker or the installed folder does not match. Without bridge configuration it
stays silent.

### Review threads in the workbench

- The bridge serves the worktree's **code threads** (`isCodeThread`: editor comments and the diff's new-side comments;
  old-side diff and browser threads stay in their panels) as `EditorThread` (root, replies with author/label,
  `status`, `pending`, `createdAt`) via `threads` and pushes a `threads` event to that worktree's clients on every
  `comment.changed` (`drafts` was renamed; the vsix is rebuilt from `buildInputs`, which include the comments contract,
  so old and new never mix).
- A new comment offers **Add to drafts** (first form action: the primary button and the Ctrl+Enter default, like the
  app's ⌘Enter), **Send now** (adds it and sends the worktree's whole review round, `send(worktreeId)`, once, the same
  as every other surface) and **Cancel**. `reply { threadId, body, send }` adds a user reply (and with `send` sends
  the round), `setStatus`, `deleteThread`, `send` go to the comments service.
- The extension draws each thread as a VS Code `CommentThread`: header label `L3 · Open` / `L3–5 · Resolved`,
  root + replies (author You / agent label / Agent, creation time, `Pending`
  label and `pragma-comment-pending` context on unsent items), `state` Resolved/Unresolved, collapsed when resolved,
  `contextValue` `pragma-thread-open` / `pragma-thread-resolved`. Threads are updated in place, so a half-typed reply
  survives a push. The collapsed reply button reads **Reply** (the controller's `prompt`); it opens Reply / Reply and
  send / Cancel (Cancel is a no-op command: the workbench collapses the box after any form action). Resolve / Reopen /
  Delete Thread show in the title of stored threads only, so a new comment has just the workbench's own discard icon.
  A comment the app could not store stays as `Not sent` with a Discard title action (`pragma-thread-unsent`). Its
  strings are fixed English in `bridge-extension/src/constants.ts` and the manifest (outside the app's i18n, as
  before), worded like the comments module.
- Test ops: `threads`, `replyThread { id, body, send }`, `setThreadStatus { id, status }` (`draftThreads` was renamed).

## Test-only overrides (read only when `PRAGMA_TEST=1`)

`PRAGMA_EDITOR_RELEASE_OVERRIDE` (release JSON), `PRAGMA_EDITOR_DOWNLOAD_CACHE` (archive cache dir),
`PRAGMA_EDITOR_SERVER_ROOT` (pre-extracted server), `PRAGMA_EDITOR_BRIDGE_VSIX`. Main test hooks:
`globalThis.__pragmaEditorTest` (`status`, `request`, `openViews`, `viewBounds`, `evalInWorkbench`, `sendKey`,
`openFile`, `probeHits`, `serverInfo`). The extension answers `editor.testRequest` only with `PRAGMA_TEST=1`.
