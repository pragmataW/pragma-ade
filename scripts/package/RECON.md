# Phase 12 recon (2026-11-02, branch `phase/12-packaging` from main `397b535`)

Plan names → actual values in the merged code.

## Host

| Name | Value |
|---|---|
| macOS | 26.5.2 (25F84), arm64 |
| Node | v25.8.0 |
| pnpm | 11.9.0 |
| npm | 11.11.0 |
| Rosetta | present (`arch -x86_64 /usr/bin/true` → 0) |
| Docker | CLI 29.2.1; daemon **running** (server 29.2.1) |
| Wine | not installed (not needed) |
| Free disk | ~97 GB |

## Root scripts (00)

| Plan | Actual |
|---|---|
| `package:mac\|linux\|win\|all` → `node scripts/package/cli.ts build <alias>` | `node scripts/package/index.ts mac\|linux\|win\|all` → `scripts/package/index.ts` added; it runs the same CLI. A bare target spec means `build`; `all` is the `all` command (build all + `--deep` + smoke). |
| `pnpm build` → `apps/desktop/out/main/index.js` | `pnpm --filter @pragma/desktop build` (`electron-vite build`), `prebuild` = `pnpm gen` (runs every `pragma.build`) → `apps/desktop/out/{main,preload,renderer}` |

## `apps/desktop`

| Name | Value |
|---|---|
| package | `@pragma/desktop` 0.1.0, `type: module`, `main: out/main/index.js` |
| dependencies | `better-sqlite3` 13.0.3 (externalized **bare** by `externalizeDeps: true`) |
| electron | 45.2.1 (devDependency) |
| `vite/native-externals.ts` | `nativeExternals()` → `external: 'relative'` for native packages of workspace modules. Today only `@parcel/watcher` (from `modules/projects`): `../../../../node_modules/.pnpm/@parcel+watcher@2.6.0/node_modules/@parcel/watcher/index.js` in `out/main/index.js` |
| other bare specifiers in `out/main` | Node builtins, `electron`, and `require("ajv/…")` / `require("ajv-formats/…")` inside code-generation template strings of ajv (not real requires → reported as unresolved warnings) |
| `fuses.ts` | `ELECTRON_FUSES = { runAsNode: true, enableNodeCliInspectArguments: true }` — Electron defaults; phase 12 does not flip fuses |

## `pragma.build` / `pragma.package.extraResources`

| Owner | Declared by | from → to | Built by |
|---|---|---|---|
| terminal | `modules/terminal` | `packages/pty-daemon/dist` → `packages/pty-daemon/dist` | owner `pragma.build: build` (esbuild, `node-pty` external, bare `require("node-pty")`) |
| editor | `modules/editor` | `packages/bridge-extension/dist` → `packages/bridge-extension/dist` | sub-package `pragma-bridge` `pragma.build: build:vsix` |
| cli-integration | `modules/cli-integration` | `packages/cli/dist/pragma.cjs` → `packages/cli/dist/pragma.cjs` (file); `skills` → `skills` | sub-package `@pragma/cli` `pragma.build: build` |
| claude | `providers/claude/packages/hooks` | `dist` → `hooks` | sub-package `pragma.build: build` |
| opencode | `providers/opencode/packages/hooks` | `dist/plugin` → `hooks/plugin` | sub-package `pragma.build: build` |

Runtime lookups use the same `to` paths: terminal `packages/pty-daemon/dist/pty-daemon.cjs`, editor `packages/bridge-extension/dist/pragma-bridge.vsix`, cli `packages/cli/dist/pragma.cjs` + `skills`, claude `hooks/pragma-hook.mjs`, opencode `hooks/plugin`. SDK `createResourcePaths`: packaged → `join(process.resourcesPath, 'modules', id, rel)`.

The plan's examples (`to: 'pty-daemon'`, `to: 'pragma-bridge.vsix'`) differ from the real declarations; the tool reads whatever is declared.

## Test support and contracts

| Plan | Actual |
|---|---|
| `@pragma/test-support` `createFixtureRepo()` | exists (`@pragma/test-support`, node entry) |
| `launchApp({ executablePath, userDataDir, env, dialogStubs })` | exists (`@pragma/test-support/e2e`); always sets `PRAGMA_TEST=1` and `PRAGMA_USER_DATA` |
| `@pragma/sdk` `ShellTestIds` | exists (`shellReady`, `rightTab(id)`, …) |
| projects testids | `PROJECTS_TESTIDS` in `modules/projects/src/contract/testids.ts` (`add`, `worktreeRow`, …); IPC `projectsIpc.addProject/selectWorktree/getState` |
| terminal testids | `TerminalTestIds` in `modules/terminal/src/contract/testids.ts` (`view`, `newTab`, …) |
| `@pragma/module-bridge/client` `readBridgeInfo()` | exists (`modules/bridge/src/client/info.ts`) |
| module contracts from `test/e2e/packaging` | root `package.json` has no dependency on `@pragma/module-*`, so the smoke test imports the `/contract` entry files by relative path (`modules/<id>/src/contract/index.ts`) |

## Lint scope

| Tool | Scans `dist/`? |
|---|---|
| Biome (`biome check .`) | **yes** (no VCS ignore in `biome.json`): a `dist/x.js` gave format/lint errors; `JSON.stringify(…, null, 2)` output passes. The tool therefore removes electron-builder's unpacked app dirs (`mac*/`, `*-unpacked/`) from `dist/<target>/` after each build. |
| jscpd | no (`.ts/.tsx` only; `dist` has none) |
| check-literals | no (uses `.gitignore`, `dist/` is ignored) |
| root `tsc -p tsconfig.node.json` | includes `scripts/**/*` and `test/**/*.ts` → the tool's TS files are type-checked by the root too. Tool-only packages (`electron-builder`, `@electron/asar`, `yaml`) are loaded through `lib/deps.ts` with non-literal specifiers so the root typecheck passes without `scripts/package/node_modules`. |

## npm cross-platform install (Task 5)

`npm install --os=win32 --cpu=x64 --prefer-offline` installed `@parcel/watcher` **without** `@parcel/watcher-win32-x64` (cached packuments); the same command without `--prefer-offline` installs it. The tool therefore does not pass `--prefer-offline`.

## Docker (Task 6)

- `docker pull` / `docker run` with the user's client config hung indefinitely (Docker Desktop credential helper `desktop`); with an anonymous config (`DOCKER_CONFIG` → `<cache>/docker-config/config.json` = `{"auths":{}}`) plus `DOCKER_HOST` from `docker context inspect`, `debian:bookworm-slim` pulled in seconds. The tool always runs Docker this way; the user's `~/.docker` is only read.
- `docker.int.ts` `compiles node-pty for linux-x64`: passed (`node:22-bullseye`, linux/amd64); `pty.node` is ELF x86-64, max `GLIBC_2.x` ≤ 2.31.

## Final run (Task 13)

- `pnpm package:all` → exit 0: 8 artifacts, every audit ok, deep probe ok on darwin-arm64 (host), darwin-x64 (Rosetta), linux-x64 (Docker `debian:bookworm-slim`), smoke 8/8.
- electron-builder 26.18.0 worked for every target (no fallback to 26.17.0); NSIS built without Wine.
- electron-builder needs `homepage` for Linux packages → the staged package.json carries one.
- The NSIS setup stub is a 32-bit PE for every arch.
- One transient `unable to verify the first certificate` during an electron-builder download; a re-run passed (the tool now retries once).
- Linux `node-pty` 1.1.0 compiled in Docker: max `GLIBC_2.28`.
