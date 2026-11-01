# Agents (`@pragma/module-agents`)

Agent profiles (Claude Code, OpenCode 2.x, custom) and agent sessions: each session is one tab in the `agents` center
view, running the profile's command in a worktree. Phase 03 ships the `terminal` mode (a pty from 02); other modes
(11a chat) plug in through a mode handler. Depends on `projects` and `terminal`.

## Main service — `AgentSessionsServiceToken` (`agents.sessions`)

| Method | Notes |
| --- | --- |
| `listProfiles({ launchableOnly? })`, `getProfile(id)` | Effective command/args plus the stored overrides and the provider's stock line. |
| `startSession({ worktreeId, profileId?, initialPrompt?, mode = 'terminal', resume?, newWorktree? })` | Default profile when `profileId` is omitted. `newWorktree: { branch, baseBranch? }` creates a worktree in `worktreeId`'s project first (the profile is validated before). Never rejects for launch failures: the session row gets `status: 'error'` and `error: { code, message }`. |
| `relaunchSession(id, { mode?, initialPrompt?, resume? })` | Same row and tab, new process (after the old one exited). |
| `listSessions(worktreeId, { includeClosed? })`, `getSession(id)` | Sorted by `ordinal`. |
| `stopSession(id)` | `term` → 5 s → `kill` → 5 s; resolves only after the mode handler reported the exit, else rejects `stopFailed`. |
| `closeSession(id)` | Stops if running, sets `closedAt`, deletes the session temp dir. |
| `focusSession(id)` | `lastFocusedAt = now` (UI focus goes through the `agents.focusSession` command). |
| `updateSession(id, patch)` | `title`, `status` (`working`/`waiting`/`idle` belong to 04), `externalSessionId` (11c). |
| `getLastFocusedSession(worktreeId)` | For 04/05. |
| `registerModeHandler(mode, handler)` | Duplicate mode throws; returns an unregister function. |
| `registerLaunchDecorator(decorator)` | Duplicate id throws; returns an unregister function. |
| `buildLaunchEnv({ sessionId, resume? })` | §10.3 env-only pipeline for non-pty launches (11a): the FULL env (login-shell env ⊕ `PRAGMA_SESSION_ID` ⊕ decorator env). |
| `listModes()` | Registered mode ids. |

Statuses: `starting` → (04: `working` / `waiting` / `idle`) → `exited` | `error`. On app start every open session
that was not ended is marked `exited` (no reattach in 03); "Start again" relaunches it in the same tab.

## Launch pipeline and decorators

1. The provider's `launch` capability (`buildLaunch(ctx) → { command, args, env, cwd, tempFiles? }`) builds the
   base spec from the profile (`baseLaunchSpec(ctx)`, `initialPromptOf(ctx)` from the contract). Prompts longer
   than `INLINE_PROMPT_MAX_CHARS` go to a 0600 file in the session temp dir.
2. Decorators run in ascending `order`, then `id`. Each gets a `structuredClone` of the spec and the
   `LaunchContext` (`profile`, `worktreeId`, `worktreePath`, `sessionId`, `initialPrompt`, `env` additions so far,
   `mode`, `resume`, read-only `shellEnv`, `tempDir`, `writeTempFile`). `spec.env` holds ADDITIONS only; 03 merges it
   over the login-shell env at the end.
3. Failure isolation: a decorator that throws or returns a spec failing `launchSpecSchema` is logged and skipped; the
   last valid spec wins. With no decorators registered, the launch is exactly profile args + prompt format.
4. `ctx.resume` (11c) is passed through untouched; a decorator turns it into args/env.

```ts
const svc = ctx.services.get(AgentSessionsServiceToken)
svc.registerLaunchDecorator({
  id: 'my-module.path',
  order: 100,
  async decorate(spec, ctx) {
    return { ...spec, env: { ...spec.env, PATH: `/my/bin:${ctx.shellEnv.PATH ?? ''}` } }
  },
})
```

### Writing a mode handler

```ts
svc.registerModeHandler('chat', {
  async start({ session, profile, worktree, initialPrompt, resume, reportExit }) {
    const env = await svc.buildLaunchEnv({ sessionId: session.id, resume })
    // start your process/client …; call reportExit(code) exactly once, only when it really ended
    return { ptyId: null }
  },
  async stop(session, signal /* 'term' | 'kill' */) {
    // send the signal; confirmation comes only through reportExit
  },
})
```

The renderer side registers an `agentSession.view` slot entry whose `match` accepts that mode.

## Commands, events, IPC

- Commands: `agents.newSession` (main, args = `startSession` input, returns the session), `agents.focusSession
  { sessionId }` (renderer: selects the worktree, activates the `agents` view, selects the tab; callable from main),
  `agents.openLauncher { worktreeId? }` (renderer, palette; `CmdOrCtrl+T` is registered from main so it survives renderer reloads).
- Main events: `agentSession.started { sessionId, worktreeId, profileId, providerId, mode, ptyId }`,
  `agentSession.exited { sessionId, worktreeId, exitCode }`, `agentSession.updated { session, changed[] }` (after every
  persisted change).
- IPC: `agentsIpc.*` (18 channels, `agents.*`); events `agents.profilesChanged { profiles }` and
  `agents.sessionChanged { session, reveal }`. Failures reject with an `AgentsError` message; the renderer translates
  it with `agentsErrorKey(err)` (`agents:errors.<code>`).

## Slots

| Slot | Props | Rule |
| --- | --- | --- |
| `agentSession.view` | `{ session, active }` | Entries `{ id, order, match(props), component }`; the first entry (by `order`) whose `match` accepts the session renders the tab body. 03 registers `terminal` (order 10). None → `errors.modeUnavailable`. |
| `agentSession.tab.badges` | `{ session }` | All entries, in the tab after the title. |
| `agentSession.toolbar` | `{ session }` | All entries, right of the tab strip. |
| `agentLauncher.options` | `{ worktreeId, profile, options, setOptions(patch) }` | Launcher options; `options.mode` becomes `startSession.mode`. |

## Settings

Module settings `{ confirmCloseRunning: boolean }` (default `true`), switch on Settings › Agents (page id `agents`,
order 50). Profiles live in `agents_profiles`; built-ins store `NULL` overrides when equal to the stock values.

## Test ids

`AGENTS_TESTIDS` (contract) lists every `data-testid`: tabs (`tab`, `tabClose`, `newTab`), body (`sessionBody`,
`sessionEnded`, `sessionError`), launcher (`launcher`, `launcherProfile` + `data-profile-id`, `launcherPrompt`,
`launcherRunIn`, `launcherNewWorktree`, `launcherBranch`, `launcherStart`, `launcherError`, `launcherConfigure`),
settings (`profileCard` + `data-profile-id`, `profileExpand`, `commandInput`, `argsInput`, `argsError`, env rows,
`previewStock`, `previewEffective`, `reset`, `deleteProfile`, `setDefault`, `enabledSwitch`, `commandWarning`,
`compatWarning`, `testLaunch`, `checkResult`, `addCustom`, new-profile dialog ids, `confirmCloseSwitch`).

## Testing helpers (`@pragma/module-agents/testing`, test code only)

- `aProfile(over)`, `aSession(id, ordinal, over)`, `makeLaunchContext(over)`, `describeLaunchCapability(name, create)`
  (shared conformance suite for provider `launch` capabilities), `fakeCapabilityContext`.
- Fake agent (`testing/fake-agent.ts`, no test-runner import, usable from Playwright): `fakeAgentCommand()`,
  `readFakeAgentLog(path)`, `fakeAgentStarts(path)`, `waitForFakeAgentLog(path, predicate)`,
  `createFakeAgentProfile(hooks, { providerId?, name?, args?, env? })`.
- Main test hooks (`PRAGMA_TEST=1`): `globalThis.__pragmaAgentsTest` — `createProfile`, `updateProfile` (both publish
  `agents.profilesChanged`), `listProfiles`, `listSessions`, `getSession`, `startSession`, `relaunchSession`,
  `closeSession`, `checkProfile`, `getSessionOutput`, `waitForSessionStatus`, `executeCommand`.

### Fake agent

`testing/fake-agent/fake-agent.mjs` (`#!/usr/bin/env node`, `.cmd` shim on Windows) logs JSONL and runs a tiny line
editor on raw stdin (`> ` prompt, echo, backspace, Ctrl+C → exit 130, SIGTERM → 143, SIGHUP → 129, stdin end → 0).

| Env | Effect |
| --- | --- |
| `FAKE_AGENT_LOG` | JSONL log: `start { pid, argv, cwd, env }`, `data { text }`, `line { line }`, `exit { code, signal }`. |
| `FAKE_AGENT_ENV_KEYS` | Comma list of extra env keys copied into `start.env` (always: `PRAGMA_*`, `FAKE_AGENT_*`). |
| `FAKE_AGENT_VERSION` | `--version` prints it and exits 0 (no log entry); without it `--version` runs like any launch. |
| `FAKE_AGENT_EXIT_AFTER_MS` | Exits 0 after the delay. |
| `FAKE_AGENT_PLUGINS` | Comma list of ES module paths; each default export gets `{ env, log, write, onCommand(name, fn) }`. |

Built-in line commands: `/exit [code]`; plugins add more (`/name rest` calls `fn(rest)`).

## E2E

`e2e/profiles.e2e.ts`, `e2e/launch.e2e.ts` (fake agent) and `e2e/real-agents.e2e.ts` (`@real-agent`, run with
`pnpm e2e:real`; real Claude Code / OpenCode with an empty temp HOME, no prompt sent). `e2e/support/app.ts` starts the
app through a wrapper that adds `-ApplePersistenceIgnoreState YES` (macOS otherwise may block a launch with the
"reopen windows?" alert after an earlier Electron run was killed).

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
