# Agent status (`@pragma/module-agent-status`)

Live status of every agent session — `starting`, `working`, `waiting` (for the user), `idle` (`done` after a completed
turn), `error`, `exited` — on the session tab, the sidebar worktree row, board cards and the status bar, with unread
markers and a desktop notification when an agent waits for you.

## How status is detected

1. A launch decorator (`agent-status.bridge-env`, order 100) adds `PRAGMA_BRIDGE_URL` / `PRAGMA_BRIDGE_TOKEN` to every
   launch (03 already sets `PRAGMA_SESSION_ID` / `PRAGMA_WORKTREE_ID`) and asks the provider's `status` capability to
   inject its hooks for that one session (Claude: `--settings <temp file>`; OpenCode 2.x: `--standalone` +
   `OPENCODE_CONFIG_CONTENT.plugins`). Nothing is written to `~/.claude` or `~/.config/opencode`.
2. Hooks post `agent.hookEvent { sessionId, providerId, event }` to the bridge. The event is parsed by the capability of
   the **session's** provider into an `AgentStatusEvent` and fed to a pure state machine (`src/main/state-machine.ts`).
3. Fallback: no capability, no bridge, or no hook event within `fallback.hookGraceMs` (30 s, one warning logged) →
   terminal activity: output → `working`, `fallback.activityIdleMs` (5 s) of silence → `idle`.
4. Chat sessions (11a) report through `AgentStatusService.reportEvent`; they are tracked as `external` and this module
   never calls `updateSession` for them (11a is the sole writer).

Every status change is written with `AgentSessionsService.updateSession({ status, externalSessionId })` (except exits,
which 03 writes, and `external` sessions), emitted as `agentSession.statusChanged` and published to the renderer.

## API

- `AgentStatusServiceToken`: `getStatus(sessionId) → SessionStatusInfo | null` (null = not tracked in this run),
  `getWorktreeStatus(worktreeId) → WorktreeStatusInfo` (most urgent: waiting > error > working > starting > idle >
  exited; `status: null` without sessions), `reportEvent(sessionId, event) → Promise<boolean>` (false for unknown or
  exited sessions; an invalid event rejects with a zod error).
- Event `agentSession.statusChanged { sessionId, status, externalSessionId? }`.
- IPC `agent-status.list`; events `agent-status.sessionChanged`, `agent-status.worktreeChanged`.
- Command `agent-status.openSession { worktreeId, sessionId }` (notification click: selects the worktree, then runs
  `agents.focusSession`).
- Bridge namespace `agent` (`agentBridge`, request `hookEvent`).
- Capability type `status` (`StatusCapability { decorateLaunch, parseEvent, dispose? }`).

## Renderer

- Named exports of `@pragma/module-agent-status/renderer`: `StatusIcon` (`{ status, turnCompleted, size? }`),
  `StatusIconProps`, `statusVisual` — for 09 board cards and 11a chat.
- Slots: `sidebar.worktreeRow.leading` (status icon; ui-notes puts it before the branch), `sidebar.worktreeRow.badges`
  (unread pill), `agentSession.tab.badges` (reads `props.session`), `board.card.badges` (reads
  `{ taskId, sessionIds }`, summarizes known sessions), `statusbar.right` (working / waiting counts).
- Settings › Notifications (order 60): notification switch, idle seconds for the activity fallback.
- Test ids and data attributes: `AGENT_STATUS_TEST_IDS`, `AGENT_STATUS_DATA_ATTRS` (`data-status`, `data-visual`, …).

## Other entry points

- `./client` (hook side, zod-free, bundled into hook scripts): `readHookEnv`, `sendHookEvent` (never throws),
  `createSendQueue`, `claimStatusReporter` (nested-agent guard via `PRAGMA_STATUS_CLAIMED`), `truncateField`.
- `./bundle-hook` (`scripts/bundle-hook.mjs`, build scripts only): `bundleHook({ entry, outfile })` — esbuild with
  workspace sources marked side-effect free, so a hook bundle pulls in only what it uses.
- `./testing`: `activityAgentPath`, `spawnFake`, `startRecordingAgentBridge`, and the Playwright helpers
  (`registerStatusSuite`, `launchWithRepo`, `setProfile`, `createCustomProfile`, `startSession`, `send`, `hooks`,
  `tabBadge`, `worktreeBadge`, `unreadPill`, `expectActivityFallback`, `runRealSession`, `expectConfigUnchanged`).

## Adding status to a new provider

1. `providers/<id>/src/main/status.capability.ts`: `defineCapability('<id>', 'status', (capCtx) => …)` with
   `decorateLaunch(spec, ctx)` (write per-session files only with `ctx.writeTempFile` into `ctx.tempDir`) and
   `parseEvent(raw) → AgentStatusEvent | null`.
2. Hook code in `providers/<id>/packages/hooks`, built with `pragma.build` (an npm script name) through
   `bundleHook`, shipped with `pragma.package.extraResources` and found with `capCtx.paths.resource('<to>/…')`. It uses
   `sendHookEvent`, stays silent and always exits 0.

## Requirements

OpenCode ≥ 2.2 (status only in `--standalone` sessions; `--server <url>` sessions use the activity fallback), Claude
Code with `--settings`, and the Electron `runAsNode` fuse on (§10.1.8: the Claude hook runs Electron as Node).

## Notes for later phases

- 09: render the `board.card.badges` slot with `{ taskId, sessionIds }`.
- 10: use `readBridgeInfo` + `postBridgeMessage` from `@pragma/module-bridge/client`.
- 11a: `reportEvent` for chat sessions; `StatusIcon` for the chat header.
- 11c: `SessionStatusInfo.externalSessionId` / `agentSession.statusChanged` carry the provider session id; the fake
  Claude takes `FAKE_CLAUDE_SESSION_ID`.
