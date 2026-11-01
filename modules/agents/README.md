# Agents (`@pragma/module-agents`)

Agent profiles (Claude, OpenCode 2.x, custom) and agent sessions started as terminal sessions in a worktree.
The final reference (services, decorators, mode handlers, commands, events, slots, fake agent) is completed in
Task 18 of `docs/plans/03-agent-profiles.md`.

## Integration notes

Verified against the merged code of phases 00–02 (Task 1). Where the plan's names differ, the real names below win.

1. **SDK.** `defineMainModule` / `defineTestHooks` from `@pragma/sdk/main`; `defineRendererModule`, `Slot`, `useT`,
   `useRendererContext`, `ProviderIcon` from `@pragma/sdk/renderer`; `createServiceToken`, `defineEvent`, `defineIpc`,
   `defineIpcEvent`, `defineCommand`, `defineCapability`, `CapabilityContext`, `slugify`, `CoreCommands`,
   `SETTINGS_PAGE_ORDER` from `@pragma/sdk`. Main → renderer events: `ctx.ipc.publish(eventContract, payload)`;
   the renderer subscribes with `ctx.ipc.subscribe(eventContract, cb)` and calls `ctx.ipc.invoke(contract, input)`.
   `<Slot id props single? fallback?>` drops entries whose `match(props)` is false and, with `single`, renders only
   the first remaining one (sorted by `order`). Settings: `defineMainModule({ settings: { schema, defaults } })`,
   `ctx.settings.get/set/update` (renderer `update` is async). `ctx.commands.register(id | defineCommand(...), handler,
   { titleKey, palette })`. `ctx.shortcuts.register({ id, accelerator, scope: 'app' | 'global', command, titleKey })`.
   Renderer `ctx.views.registerCenterView({ id, titleKey, icon, component, default })` and `ctx.views.activate(id)`.
   `ctx.providers`: `list()`, `get(id)`, `capability(id, key)`, `providersWith(key)` (descriptors). The capability
   factory context type is `CapabilityContext` (`log`, `paths`, `getShellEnv`, `resolveCommand`, `settings`).
   DB handle: `PragmaDb` from `@pragma/sdk/db` (drizzle helpers re-exported there). Test DB: `openDatabase` +
   `applyMigrations` from `@pragma/sdk/runtime/main` (test code only; module `src` may not import `runtime`).
2. **SDK helpers (§10.4).** `ctx.env.resolveCommand(cmd): Promise<string | null>` — resolves against the login-shell
   PATH only (no `env`/`cwd` parameter) and has no `notExecutable` result, so this module never reports
   `notExecutable`. `slugify(text, { maxLength })` from `@pragma/sdk`. `<Icon name>` from
   `@pragma/ui/components/icon`. `registerCenterView({ default: true })` exists.
3. **Provider icons.** `<ProviderIcon providerId size />` from `@pragma/sdk/renderer` (renderer `ctx.providers.icon(id)`),
   a monogram per provider.
4. **projects (01).** `ProjectsServiceToken.getWorktree(id) → Worktree | null` with `{ id, projectId, path, branch,
   baseBranch, isMain, createdAt, archivedAt }`; `getProject(id) → { repoPath, … }`; `createWorktree({ projectId,
   branch, baseBranch?, path? }) → Worktree` (throws `ProjectsError`, never selects); event `worktreeRemoved`
   (`worktree.removed`, `{ worktreeId, projectId, path, reason }`); main command `projects.selectWorktree
   { worktreeId }`; `GitServiceToken.defaultBaseBranch(repoPath)`. Renderer: `ProjectsRendererServiceToken`
   (`getActiveWorktree()`, `subscribe(listener)`, `selectWorktree(id)`).
5. **terminal (02).** `PtyServiceToken`: `spawn({ cwd, command?, args?, env?, tags?, cols, rows }) → Promise<ptyId>`
   (rejects `PtySpawnError`); `onExit(ptyId, cb({ exitCode, signal, reason }))` fires once, also for every pty when the
   daemon dies (`reason: 'daemon-restarted'`, `exitCode: null`); `onData(ptyId, cb)`; `kill(ptyId, signal?)` takes
   `'SIGTERM' | 'SIGKILL' | …` and resolves after the confirmed exit (02 itself escalates to SIGKILL after 3 s);
   `getShellEnv()` is async. Renderer: `TerminalViewServiceToken` → `{ TerminalView }` with props `{ ptyId,
   className?, autoFocus?, onExit? }`; an exited pty shows 02's banner. 02 binds no `CmdOrCtrl+T`, so the launcher uses it.
6. **test-support.** `launchApp({ userDataDir, env })` from `@pragma/test-support/e2e` (`restart()` relaunches on the
   same userData); `createFixtureRepo`, `isolatedGitEnv` from `@pragma/test-support`; main test hooks are installed on
   `globalThis` by `src/main/test-hooks.ts` and called through `app.evaluate`; a second worktree comes from
   `projectsIpc.createWorktree` (with `projects.worktreesRoot` pointing into the temp dir).
7. **Provider tests.** `pnpm test` collects `providers/<id>/test/*.test.ts` (root Vitest `node` project). E2E files are
   `*.e2e.ts` (root Playwright `testMatch`), so this module's specs are named `e2e/<name>.e2e.ts`; `.test.tsx` files run
   in jsdom (not happy-dom).
