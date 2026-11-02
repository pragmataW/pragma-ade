# CLI integration (`@pragma/module-cli-integration`)

Phase 10. Ships the `pragma` command-line tool, the `pragma-handoff` and `pragma-cli` agent skills, and the module
that serves the CLI's `cli.*` bridge namespace, puts `pragma` on every agent's `PATH` and installs the CLI and the
skills from Settings › Command line.

Dependencies: `projects`, `agents`, `bridge` (required); `board`, `comments` (optional — without them the matching
`pragma` commands fail with `module_unavailable`, everything else works).

## What the module provides

- **Bridge namespace `cli`** (`src/main/handlers`): `worktreeList`, `worktreeCreate`, `agentList`, `agentSpawn`,
  `profileList`, `taskList`, `taskCreate`, `taskUpdate`, `taskMove`, `commentsList`, `handoff`, plus `ping`. Every
  handler answers the envelope `{ ok: true, result } | { ok: false, error: { code, message, details? } }`
  (`cliResponseSchema`); error codes are `CLI_ERROR_CODES`. Board/comments missing → `module_unavailable`.
- **Launch decorator** `cli-integration.path` (order 500): prepends `<userData>/modules/cli-integration/bin` (the
  generated shim) to every agent's `PATH` and sets `PRAGMA_CLI` (shim path) and `PRAGMA_BRIDGE_FILE`.
- **Shim**: `bin/pragma` (POSIX, `ELECTRON_RUN_AS_NODE=1 exec <electron> <bundle>`) or `bin/pragma.cmd` (win32),
  rewritten on every start. Needs the `runAsNode` fuse to stay on (§10.1.8).
- **Renderer IPC** (`cliIntegrationIpc`): `getStatus`, `installCli({ dir? })`, `uninstallCli`,
  `installSkills({ providerIds })`, event `statusChanged`. Every install runs `assertSafeHome` first (in test mode
  the real home is refused).
- **Settings › Command line** (`SETTINGS_PAGE_ORDER.cli` = 110): PATH link status/install/remove and the agent
  skill targets with a consent dialog (`SkillInstallDialog`) listing every directory that will be written.
- **Skills**: `skills/handoff` (installed as `pragma-handoff`) and `skills/pragma-cli`. Providers declare targets
  through the `skills` capability (`providers/<id>/src/main/skills.capability.ts`). The install registry is
  `<userData>/modules/cli-integration/installed-skills.json` (never inside skill dirs). States: `missing`,
  `foreign`, `current`, `outdated`. On start, one notification per skills version when an installed target is
  outdated (click opens this settings page).
- **Env vars**: `PRAGMA_CLI`, `PRAGMA_CLI_BUNDLE` (bundle override), plus the bridge/agent names it reads
  (`PRAGMA_BRIDGE_URL`, `PRAGMA_BRIDGE_TOKEN`, `PRAGMA_BRIDGE_FILE`, `PRAGMA_SESSION_ID`, `PRAGMA_WORKTREE_ID`).
- **Test hooks** (`PRAGMA_TEST=1`): `globalThis.__pragmaCliIntegrationTest.{notifications, paths}`.
- **Testing entry** (`/testing`): `runCli(args, env)` (runs the bundle with a clean env) and
  `describeSkillsCapability` (provider conformance suite).

## Packaging (phase 12)

`pragma.package.extraResources` declares `packages/cli/dist/pragma.cjs` and `skills/`; both are resolved through
`ctx.paths.resource('cli-integration', …)`, so the same relative path works in dev and packaged. The bundle is built
by `pragma.build` (`packages/cli`, esbuild) in predev/prebuild/pretest/pree2e.

## Tests

- Unit: `test/` (main side, contract, skills, renderer page in jsdom: `test/renderer/CliSettingsPage.test.tsx`) and
  `packages/cli/test`.
- E2E: `e2e/*.e2e.ts` (acceptance criteria 1–5 and the optional-dependency case); `e2e/handoff.real.e2e.ts` is
  `@real-agent` (real Claude Code on a temp HOME, login through the macOS keychain).

## Upstream API notes (Task 1 recon, verified against `main` on 2026-11-02)

Where the plan's names differ from the merged code, the real names below win. Every later task maps upstream shapes
only in `src/main/mappers.ts` and the adapter files named in its plan task.

### SDK (`@pragma/sdk`, `/main`, `/renderer`)

- `defineMainModule({ settings: { schema, defaults }, activate(ctx), deactivate() })` from `@pragma/sdk/main`;
  `defineRendererModule` from `@pragma/sdk/renderer`; `defineTestHooks((ctx) => …)` from `@pragma/sdk/main`.
- `MainContext`: `module.paths.{root,data}` (data = `<userData>/modules/<id>`), `paths.{userData,logs,temp}`,
  `paths.resource(moduleId, relPath)`, `settings.get/set/update/onChange`, `ipc.handle/publish`, `providers`
  (`list`, `get`, `capability(id, key)`, `providersWith(key)` → descriptors with `id`, `displayNameKey`),
  `notifications.show(n)`, `env.getShellEnv()` / `env.resolveCommand()`, `commands.execute`, `i18n.t`, `testMode`,
  `log`.
- `NotificationInput = { titleKey, bodyKey, params?, onClickCommand?: { id, args? } }` (`CommandRefSchema`).
- Settings page opener: command `CoreCommands.openSettings` (`core.openSettings`) with args `{ pageId }`.
- Settings page order: `SETTINGS_PAGE_ORDER.cli` (= 110) from `@pragma/sdk`.
- Manifest: `pragma.build` is an **npm script name**; sub-packages carry `pragma.build`, `buildInputs`,
  `buildOutputs`; `pragma.package.extraResources: [{ from, to }]` with `to` module-relative, resolved by
  `ctx.paths.resource('<id>', '<to>')`.
- Helpers: `writeFileAtomic(path, data, { mode })` and `readJsonFile(path, schema)` (`@pragma/sdk/main`, both
  synchronous), `slugify(text, { maxLength })`, `APP_NAME`, `USER_DATA_ENV`, `TEST_MODE_ENV`, `defaultUserDataDirs`
  (`@pragma/sdk`). `tsconfig.base.json` has `erasableSyntaxOnly` (no parameter properties, no enums).
- Renderer: `ctx.settingsPages.register({ id, titleKey, order, component })`, `ctx.ipc.invoke/subscribe`, `useT()`,
  `useRendererContext()`. `ctx.dialogs.confirm({ titleKey, messageKey, params })` shows only one message, so the
  skill consent step is a `@pragma/ui` dialog (`SkillInstallDialog`).

### bridge (`@pragma/module-bridge/contract`, `/client`, `/testing`)

- Env names: `BRIDGE_ENV = { url: 'PRAGMA_BRIDGE_URL', token: 'PRAGMA_BRIDGE_TOKEN', file: 'PRAGMA_BRIDGE_FILE' }`
  (imported, never redeclared). Session/worktree env names come from agents (`AGENT_ENV`, below).
- `readBridgeInfo({ env?, userDataDirs?, platform?, home? })` → `{ url, token, wsUrl, source }`; order env pair →
  `PRAGMA_BRIDGE_FILE` → `$PRAGMA_USER_DATA/bridge.json` → SDK default userData dirs. Missing/invalid →
  `BridgeUnavailableError` with `reason: 'no_config'`. A `PRAGMA_BRIDGE_FILE` pointing at a missing file is skipped
  (falls through to the next candidate), so the CLI checks that case itself to give the hint.
- `postBridgeMessage({ url, token }, { type, payload }, { timeoutMs })` → result payload; one `AbortSignal.timeout`
  covers connect + response. `BridgeUnavailableError('unreachable' | 'unauthorized')`, `BridgeRequestError(code)`.
- Server: `BridgeServerToken` → `registerHandler(namespace, handlers)` returns a disposer. Raw handlers are
  `(payload, reqCtx) => unknown`. **A thrown error reaches the client as `handler_error` with the message only**, so
  the `cli` namespace answers with an envelope `{ ok: true, result } | { ok: false, error: { code, message, details } }`
  to keep `CliErrorCode`s (decision recorded in the phase report).
- `@pragma/module-bridge/testing`: `startTestBridgeServer({ token?, port? })` → real server + `connection` +
  `infoDir` with its `bridge.json`.

### agents (`@pragma/module-agents/contract`, `/testing`)

- `AgentSessionsServiceToken`: `listProfiles()`, `getProfile(id)`, `startSession({ worktreeId, profileId?,
  initialPrompt?, mode?, newWorktree? })` (never rejects for launch failures: the session gets `status: 'error'`),
  `listSessions(worktreeId)`, `getSession(id)`, `registerLaunchDecorator(d)` → disposer, `buildLaunchEnv`.
- `AgentProfile`: `id, providerId, name: string | null` (null for built-ins → `displayNameKey`), `enabled,
  isDefault, available, …`. The CLI's profile name is `name ?? i18n.t(displayNameKey)`.
- `AgentSession`: `id, worktreeId, profileId: string | null, providerId, mode, title: string, status, createdAt, …`.
- `LaunchDecorator = { id, order, decorate(spec, ctx) }`; `LaunchContext` has `env` (additions so far), `shellEnv`
  (read-only login-shell env), `worktreeId`, `sessionId`. `LaunchSpec.env` holds additions merged over the shell
  env by 03, so PATH must be a full value; the decorator uses `ctx.shellEnv.PATH` as the base (no separate
  `getShellEnv()` call needed).
- `AGENT_ENV = { sessionId: 'PRAGMA_SESSION_ID', worktreeId: 'PRAGMA_WORKTREE_ID' }`.
- Command `agentsCommands.focusSession` (`agents.focusSession`, args `{ sessionId }`).
- Testing: `createFakeAgentProfile(hooks, { name, env })`, `fakeAgentStarts(log)`, `FAKE_AGENT_ENV`
  (`log`, `plugins`, …). Fake-agent plugins (`FAKE_AGENT_PLUGINS`) get `{ env, log, write, onCommand }` at start,
  so the CLI probe is a fake-agent plugin rather than a separate custom profile.

### projects (`@pragma/module-projects/contract`)

- `ProjectsServiceToken`: `listProjects()`, `listWorktrees(projectId)`, `getWorktree(id)`, `createWorktree({
  projectId, branch, baseBranch?, path? })` (an existing local branch is checked out, not an error; a non-empty path
  → `ProjectsError('pathExists')`, invalid name → `invalidBranchName`, checked-out branch → `branchCheckedOut`),
  `getActiveWorktreeId()`.
- `Worktree = { id, projectId, path, branch: string | null, baseBranch, isMain, createdAt, archivedAt }`.

### board (`@pragma/module-board/contract`, `/testing`)

- `BoardServiceToken`: `getBoard(projectId)` (columns/labels), `listTasks(filter)` (`projectId`, `column`,
  `sessionId`, …), `getTask(ref)` (number, digit string or key), `createTask({ projectId, title, descriptionMd?,
  priority?, labels?, column? })`, `updateTask(id, patch)`, `moveTask(id, column)`, `linkSession(taskId, sessionId)`.
  Errors are `BoardError(code)` (`column_not_found`, `not_found`, …). Mutations emit `board.changed`.
- `TaskDto` has `columnId` and `labelIds` (no names) → the mapper resolves names from `getBoard`.
- `PRIORITIES = ['none','low','medium','high','urgent']`, `IN_PROGRESS_COLUMN_NAME = 'In Progress'`,
  `BOARD_TESTIDS`; `BoardPage` (Playwright) from `/testing`.

### comments (`@pragma/module-comments/contract`)

- `CommentsServiceToken.listDrafts(worktreeId)` — every stored comment is a draft (sent ones are deleted,
  post-review change 2026-11-02). `Comment = { id, worktreeId, source, filePath?, lineStart?, lineEnd?, body,
  createdAt, … }`.

### test-support

- `launchApp({ userDataDir, env, disabledModules, dialogStubs })`, `invokeIpc`, `openSettingsPage(page, pageId)`,
  `executeCommand`, `saveScreen(page, phase, name)`, `forceNativeTheme` (`@pragma/test-support/e2e`);
  `createFixtureRepo`, `isolatedGitEnv`, `createTestModuleHost`, `loadModuleRecord` (`@pragma/test-support`).
- E2E specs are `e2e/*.e2e.ts`, run by the root Playwright config (`pnpm e2e`, or
  `pnpm --filter @pragma/module-cli-integration e2e`).
- Root `tsc` covers `modules/*/packages/*/src/**` but not `packages/cli/test`; the CLI package has its own
  `typecheck` script (`tsc -p tsconfig.json`).
