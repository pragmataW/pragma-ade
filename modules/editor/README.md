# editor — `@pragma/module-editor`

Phase 06. The right-panel **Files** tab is a real VS Code workbench: VSCodium `reh-web` (pinned 1.143.17232, VS Code
1.143.1) served on `127.0.0.1` and shown in one `WebContentsView` per worktree. The bundled VS Code extension
`pragma-bridge` (sub-package `packages/bridge-extension`) talks to the app over 04's bridge: line comments to the
agent, open a file at a line, follow the app theme, report language status.

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
| Bridge namespace | `editor` (`editorBridge`) | requests `hello`, `comment`, `testResponse`, `languageStatus`; events `openFile`, `setTheme` (broadcast), `testRequest` |
| IPC | `editor.getStatus`, `ensureReady`, `cancelDownload`, `retry`, `restartServer`, `reinstall`, `getServerInfo`, `getLanguageStatus`; events `editor.statusChanged`, `revealRequested`, `languageStatusChanged` | |
| Test ids | `EDITOR_TEST_IDS` (contract) | For other modules' E2E. |

## Settings (`settings.json` → `editor`)

`maxOpenViews` (1–16, default 4, LRU), `themeMap` (`{ dark: 'Dark Modern', light: 'Light Modern' }`), `syncPalette`
(push the app palette of both modes into `workbench.colorCustomizations`, one `[<theme>]` block per `themeMap` theme
so the active theme always gets its own palette; only Pragma-managed keys; applies are serialized, newest wins, and
read back until they hold), `serveWebviewsLocally`
(serve `*.vscode-cdn.net/…/webview/browser/pre/*` from the local server), `reconnectionGraceSeconds` (300).

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

## Test-only overrides (read only when `PRAGMA_TEST=1`)

`PRAGMA_EDITOR_RELEASE_OVERRIDE` (release JSON), `PRAGMA_EDITOR_DOWNLOAD_CACHE` (archive cache dir),
`PRAGMA_EDITOR_SERVER_ROOT` (pre-extracted server), `PRAGMA_EDITOR_BRIDGE_VSIX`. Main test hooks:
`globalThis.__pragmaEditorTest` (`status`, `request`, `openViews`, `viewBounds`, `evalInWorkbench`, `sendKey`,
`openFile`, `probeHits`, `serverInfo`). The extension answers `editor.testRequest` only with `PRAGMA_TEST=1`.
