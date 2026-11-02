# Terminal (`@pragma/module-terminal`)

Terminal sessions hosted by a separate **pty-daemon** process, so they survive renderer reloads. The right-panel
`terminal` tab shows the active worktree's terminals (tabs, one binary split per tab). `PtyService` and
`TerminalView` are the reusable pieces: phase 03 runs agents with them unchanged.

## Provides

**Main service** — `PtyServiceToken` (`terminal.pty`, from `@pragma/module-terminal/contract`):

| Method | Notes |
|---|---|
| `spawn({ cwd, command?, args?, env?, tags?, cols, rows }) → ptyId` | No `command`: the default shell (`terminal.shell` setting, else `$SHELL` / platform shell; `-l` on macOS). Bare commands go through `ctx.env.resolveCommand`. Env = login-shell env (`ctx.env.getShellEnv()`) < `opts.env` < `TERM=xterm-256color`, `COLORTERM`, `TERM_PROGRAM=PragmaADE`, `PWD`. Rejects with `PtySpawnError` (`CWD_NOT_FOUND` \| `SPAWN_FAILED` \| `UNAVAILABLE`); no session is left behind. |
| `write`, `resize`, `paste(ptyId, text)` | No-ops (logged) for unknown/exited ptys. `paste` is bracketed iff the program enabled mode 2004. |
| `isBracketedPasteEnabled(ptyId)` | Synchronous, from the daemon's DECSET/DECRST 2004 tracking. |
| `kill(ptyId, signal?)` | `SIGTERM` (default), `SIGKILL`, `SIGINT`, `SIGHUP`; escalates to SIGKILL after 3 s; resolves after the **confirmed** exit, then forgets the pty. win32: the process is terminated. |
| `onData(ptyId, cb)`, `onExit(ptyId, cb)` | `onExit` fires once (`{ exitCode, signal, reason: 'exited' \| 'killed' \| 'daemon-restarted' }`), immediately (async) if the pty already exited. |
| `onInput(ptyId, cb)` | Data sent with `write` (keyboard input of views and services; not `paste`), after it was sent. Used by 04 to see Esc / Ctrl-C in agent sessions. |
| `get`, `list({ tags })`, `snapshot`, `getShellEnv` | `getShellEnv` delegates to `ctx.env.getShellEnv()`. |

**Renderer service** — `TerminalViewServiceToken` (`terminal.view`, §10.1.1):
`ctx.services.get(TerminalViewServiceToken).TerminalView` renders `<TerminalView ptyId className? autoFocus? onExit?
onTitleChange? />`. It restores the pty's screen from a snapshot, then streams live output (sequence-gated: nothing
lost or doubled), forwards input and size, and shows a banner when the pty exited, is unknown (“no longer
available”) or failed. It reads the terminal module's own renderer context, so it works inside any module's tree.

**IPC** (`terminalIpc`, `terminalIpcEvents`, channel names in `TerminalChannels`): `terminal.ptyAttach`,
`ptyWrite`, `ptyResize`, `openLink` (http/https only), `layoutGet`, `tabCreate`, `tabClose`, `tabRename`,
`tabActivate`, `tabSplit`, `paneClose`; events `terminal.ptyData {ptyId, seq, data}`, `ptyExit`, `layoutChanged`,
`serviceRestarted`.

**Commands** (renderer, palette): `terminal.newTab`, `terminal.closeTab`, `terminal.splitVertical` (side by side),
`terminal.splitHorizontal` (stacked), `terminal.focusSearch`.

**Test ids** — `TerminalTestIds` (contract): `view`, `status`, `panel`, `empty`, `tab(id)`, `tabStatus`, `tabRename`,
`newTab`, `splitVertical`, `splitHorizontal`, `paneClose`, `searchBar`, `searchInput`, `searchResults`. A view root
also carries `data-pty-id`, `data-state` (`attaching|live|exited|not-found|error`) and `data-renderer`
(`webgl|dom`).

**Settings** (`terminal` section, schema `TerminalSettingsSchema` in the contract): `shell` (null = default),
`fontFamily`, `fontSize` (8–32, default 12), `scrollback` (500–100000, default 5000), `renderer` (`auto` | `dom`).

## Reusing for agents (03)

1. Spawn with your own tags: `pty.spawn({ cwd, command, args, env, cols, rows, tags: { owner: 'agents', sessionId } })`.
   The panel only ever kills ptys tagged `{ owner: 'terminal' }`.
2. Render `ctx.services.get(TerminalViewServiceToken).TerminalView` with the ptyId.
3. Handle `PtySpawnError` (show `error.code` / message).
4. Treat a view in `not-found` state, or an exit with `reason: 'daemon-restarted'`, as “session ended”. `onExit`
   fires for every running pty when the daemon crashes.
5. Stopping: `await pty.kill(id)` (or `'SIGKILL'` for a hard stop) returns only after the process is gone.

## Comments (05)

Deliver multi-line text with `PtyService.paste(ptyId, text)`; check `isBracketedPasteEnabled(ptyId)` first if the
format depends on it. Line ends become CR; paste markers inside the text are stripped.

## Process model

- `packages/pty-daemon` (`@pragma/terminal-pty-daemon`) owns node-pty sessions; each session mirrors its output in an
  `@xterm/headless` terminal (serialize addon → snapshots) and coalesces output (4 ms / 64 KiB per flush).
- `pragma.build` (`build` script) bundles it with esbuild into `packages/pty-daemon/dist/pty-daemon.cjs` (node-pty
  external). Main finds it with `ctx.paths.resource('terminal', 'packages/pty-daemon/dist/pty-daemon.cjs')` and forks
  it with `process.execPath` + `ELECTRON_RUN_AS_NODE=1` (the `runAsNode` fuse stays on, §10.1.8).
- The daemon exits (after hanging up its ptys) when its IPC channel closes, so no process survives the app.
- Crash: `DaemonHost` restarts it (250 ms, 1 s, 3 s; at most 5 restarts a minute) and the renderer gets
  `terminal.serviceRestarted`.
- node-pty 1.1.0 ships `spawn-helper` as 0644; the daemon chmods it to 0755 at startup.
- Layouts (tabs/splits per worktree) live in main memory: they survive renderer reloads, not app restarts.

## Packaging notes (12)

- `extraResources` holds only the daemon `dist`. node-pty is installed by phase 12 into the target `node_modules`; it
  must be resolvable from the packaged `dist/pty-daemon.cjs`. If it is not, pass `NODE_PATH` through `DaemonHost`'s
  `env` option.
- `spawn-helper` must stay executable (0755) in the package.
- Linux has no node-pty prebuild: it is built from source.
