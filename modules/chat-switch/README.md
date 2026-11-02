# @pragma/module-chat-switch (phase 11c)

Moves one agent session in place between its chat view and its terminal view (both directions, Claude and
OpenCode 2.x), guarantees that one external conversation never runs in two processes, and delivers review comments
to chat sessions as composer chips.

## Public surface (`/contract`)

| Name | What |
|---|---|
| `ResumeCapability` (`resume` in `CapabilityMap`) | `terminalResumeArgs({ externalSessionId, serverUrl? }) → { args, env }`, `canResumeInChat` |
| `isSafeExternalSessionId`, `SAFE_EXTERNAL_ID_RE`, `INVALID_EXTERNAL_ID_MESSAGE` | argv-safe id check used by every resume capability |
| `ExternalSessionGuardToken` | `claim(key, sessionId)`, `release(sessionId)`, `ownerOf(key)` (in memory) |
| `ChatSwitchServiceToken` | `eligibility(sessionId)`, `switchTo(sessionId, target)` |
| `chatSwitchIpc` | `chat-switch.eligibility {sessionId}`, `chat-switch.switch {sessionId, target}` |
| `chatSwitchIpcEvents` | `chat-switch.changed {sessionId, phase, errorKey?}`, `chat-switch.conflict {sessionId, ownerSessionId}` |
| `chatSwitchTestIpc` (PRAGMA_TEST) | `chat-switch.test.guardOwner`, `chat-switch.test.disableRetain` |
| `CHAT_SWITCH_TESTIDS` | toggle, toChat, toTerminal, spinner, alert |

## Wiring (main)

- Launch decorator `chat-switch.resume` (order `RESUME_DECORATOR_ORDER`, before 04's status decorator): turns
  `LaunchContext.resume` into the provider's resume args/env and claims the guard.
- `switchTo` calls 03's `relaunchSession(id, { mode, resume })` on the same row; 03 stops the old process, waits for
  its exit and starts the target mode.
- Chat start guard (`ChatService.registerStartGuard`): a resume of an id owned by another session is refused.
- `agentSession.statusChanged` (04, optional) claims reported ids; a conflict publishes `chat-switch.conflict`.
- Comments delivery target `chat`: 05's text becomes a composer chip (never auto-sent).

## Renderer

- `agentSession.toolbar` entry `chat-switch.view-toggle`: segmented Chat | Terminal toggle, reason tooltips,
  confirmation through `ctx.dialogs.confirm`, inline alert for failures and conflicts.

## Integration notes (Task 1, verified against main @ d4b34fc)

See "Integration notes" in `docs/phases/reports/11c-chat-switch.md` for the full table; the short version:

| Plan name | Real name / path |
|---|---|
| `AgentSession`, `isRunningStatus`, `AgentSessionsServiceToken` | `@pragma/module-agents/contract` (`sessions.ts`, `service.ts`), same names |
| `relaunchSession(id, { mode, resume })` | forwards `resume` to `ModeStartRequest.resume` and `LaunchContext.resume` (`agent-sessions-service.ts#launchRow`, `launch/context.ts`) |
| `stopSession` | resolves only after `reportExit` (term → `STOP_GRACE_MS` → kill → `KILL_CONFIRM_MS`) |
| `agentSession.updated` | main event `agentSessionUpdated`; 03's `notify` publishes the session to the renderer store |
| OpenCode `--standalone` | `providers/opencode/src/main/launch.capability.ts` skips it when `ctx.resume.serverUrl` is set; 04's status decorator (`status/standalone.ts`, order 100) appends it unless `--server` is present |
| `AGENT_SLOTS.toolbar`, `AgentSessionToolbarProps` | `@pragma/module-agents/contract` `slots.ts` |
| `agentSession.statusChanged` | `agentSessionStatusChanged` (`@pragma/module-agent-status/contract`), payload `{sessionId, status, externalSessionId?}` |
| `CommentsServiceToken.registerDeliveryTarget`, `DeliveryRequest` | `@pragma/module-comments/contract` `service.ts` (no `status`/`sentAt`, post-review change) |
| `ChatServiceToken`, `ChatSessionContext.resumeExternalSessionId` | `@pragma/module-chat/contract` |
| chat mode handler | `modules/chat/src/main/activate.ts` (not `index.ts`); `stop` → `registry.stop(session, signal)` → `controller.close()/kill()` |
| registry `close(id)` | does not exist; `ChatSessionRegistry.stop(session, signal)` |
| `copyText`, `CopyButton` | `@pragma/ui/lib/clipboard`, `@pragma/ui/components/copy-button` |
| Claude hook fake | `providers/claude/testing/fake-claude-hooks` (`FAKE_CLAUDE_SESSION_ID`, `FAKE_AGENT_LOG`) |
| OpenCode hook fake | `providers/opencode/testing/fake-opencode-hooks` (exits 2 without `--standalone`; the session id comes only from `oc …` stdin lines) |
| E2E helpers | `@pragma/module-agent-status/testing` (`launchWithRepo({ disabledModules })`, `setProfile`), comments test hooks `__pragmaCommentsTest.createDraft` |

## Pre-existing failures

None: `pnpm lint`, `pnpm typecheck` and `pnpm test` were green on the baseline.
