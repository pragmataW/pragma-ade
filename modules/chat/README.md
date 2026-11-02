# Chat (`@pragma/module-chat`)

Runs agent sessions in a rich chat view (agent-session mode `chat`, phase 11a). Provider-agnostic: providers plug in a
`chat` capability (main) and optionally a `chatUi` definition (renderer). Claude ships both (`providers/claude`).

## How it works

- **Mode handler** `chat` (03's `registerModeHandler`): `start` creates/reuses a `ChatSessionController` and starts the
  provider session in the background (returns `{ ptyId: null }` at once); `stop` closes it (`kill` kills the process).
  03 stores `mode:'chat'`; chat never writes `mode`.
- **Controller** (one per session, `src/main/controller.ts`): every event gets `seq`/`at`, is reduced into the
  transcript, published (`chat.event`), reported to 04 (`AgentStatusService.reportEvent`, optional) and drives the
  status (`nextStatus`). **11a is the sole writer of `status`** for chat sessions (`updateSession`). Messages sent
  during a turn are queued (FIFO, one per finished turn). A send to an exited session relaunches the same row with
  `resume: { externalSessionId }` (03's `relaunchSession`) and is dispatched after the handshake. The child env is
  exactly `AgentSessionsService.buildLaunchEnv({ sessionId, resume })` (shell env + profile env + decorators).
- **History**: a session without a process is rebuilt from the provider's own transcript (`loadHistory`); no copy is
  kept.
- **Startup failures** (`ChatStartupError` with a `chat:unsupported.*` reason) end the session with `error` and are
  cached per profile command line; the New agent dialog then disables Chat with the reason.

## API

- `ChatServiceToken`: `appendToComposer(sessionId, text)` (appended, never auto-sent; 11c comments),
  `getHistory(sessionId)`.
- IPC (`chatIpc`): `chat.open`, `chat.send`, `chat.cancelQueued`, `chat.interrupt`, `chat.respondPermission`,
  `chat.respond`, `chat.setOption`, `chat.searchFiles`, `chat.checkSupport`; events `chat.event`
  (`ChatEventEnvelope`), `chat.composerAppend`. Test mode: `chat.test.snapshot`, `globalThis.__pragmaChatTest`.
- Slots: `agentSession.view` (mode `chat`), `agentLauncher.options` (Chat | Terminal), `statusbar.right` (context %),
  settings page `chat` (order 120: default mode, startup timeout).
- Shared test ids: `CHAT_TESTIDS` (`src/contract/testids.ts`).

## Event model (`src/contract/events.ts`)

Core kinds (§5.4) `message`, `text-delta`, `thinking`, `tool-call`, `tool-result`, `file-edit`,
`permission-request`, `usage`, `error`, `turn-end`, plus owner kinds `session-info`, `options`, `turn-start`, `todo`,
`permission-resolved`, `session-exit`, `queue`, `response-resolved`, and **`custom`** —
`{ kind: 'custom', type: '<provider-id>.<name>', data, eventId?, awaitsResponse? }` for provider-specific events
(interactive ones are answered through `ChatSessionHandle.respond`). Core parts ignore unknown custom types. The pure
reducer (`transcript.ts`) is idempotent by `seq` (snapshot + live tail = full replay).

## Implementing a provider (11b)

1. `providers/<id>/src/main/chat.capability.ts`:
   `defineCapability('<id>', 'chat', (capCtx) => ({ checkSupport, createSession, loadHistory?, dispose? }))`.
   `createSession(ctx)` resolves after the protocol handshake (or rejects `ChatStartupError(reasonKey, detail)`),
   emits `session-info` (with `externalSessionId`) and `options`, then streams events through `ctx.emit`. The handle
   implements `describeOptions`/`setOption`, `send`, `interrupt`, `respondPermission`, `close` (emits
   `session-exit{closed}` once) and optionally `respond`/`kill`.
2. `providers/<id>/src/renderer/chatUi.capability.tsx`:
   `defineRendererCapability('<id>', 'chatUi', definition)` (`ChatUiDefinition`), composed from the kit exported by
   `@pragma/module-chat/renderer`. Without it the kit's `defaultChatUi` is used.

## `ChatUiDefinition` how-to

```ts
export const myChatUi: ChatUiDefinition = {
  parts: { ...defaultChatUi.parts, thinking: undefined, 'custom:my.banner': MyBanner }, // add/remove a part = one line
  header: [UsageMeter],
  composerToolbar: [ModelPicker, createOptionPicker({ key: 'agent' }), ContextMeter, StopButton],
  composerExtensions: defaultComposerExtensions, // '/' commands, '@' files, images; add your own trigger menus
  groupToolCalls: true,
}
```

Kit (named exports of `@pragma/module-chat/renderer`): `MessageList`, `UserMessage`, `AssistantText`, `ThinkingBlock`,
`ToolCallCard`, `ToolCallGroup`, `FileEditDiff`, `HunkDiff`, `PermissionCard`, `TodoList`, `ErrorRow`,
`TurnEndNotice`, `SessionExitNotice`, `WorkingLine`, `AssistantTurnHeader`, `Composer`, `ComposerAttachments`,
`SlashCommandMenu`, `FileMention`, `QueueChips`, the three extensions + `defaultComposerExtensions`, `OptionPicker`,
`createOptionPicker`, `ModelPicker`, `StopButton`, `UsageMeter`, `ContextMeter`, `useCustomResponse`,
`ChatHostProvider`, `ChatSessionView`, `defaultChatUi`. Parts never touch the SDK: they use the `ChatHost` interface
(`src/contract/ui.ts`), built by `src/renderer/host-adapter.tsx` (the only renderer file touching SDK/03/04 shapes)
and stubbed in tests (`@pragma/module-chat/testing`: `stubChatHost`, `stubSessionApi`, `chatTestI18n`,
`installJsdomLayout`, `createFakeChatCapability`).

## Upstream names

Verified against the merged code (only `src/main/agents-adapter.ts` and `src/renderer/host-adapter.tsx` touch them):

- 03: `AgentSessionsService.{getSession, getProfile, updateSession, relaunchSession, registerModeHandler,
  buildLaunchEnv(LaunchEnvContext)}`, `ModeStartRequest`, `AgentLauncherOptionsProps`, `AGENT_SLOTS`. The
  `agentSession.view` `match` receives the slot props (`{ session, active }`), not the session.
- 01: there is no `listWorktreeFiles`; files come from `GitService.run(path, ['ls-files', …])`, the path from
  `ProjectsService.getWorktree`.
- 04: `AgentStatusService.reportEvent(...)` returns `Promise<boolean>`; event fields are capped at 200 chars
  (`truncateEventField`). `StatusIcon` from `@pragma/module-agent-status/renderer` is used only while agent-status is
  active (a lucide fallback otherwise).
- SDK: `ctx.providers.capability(id, 'chat')`, `ctx.providers.rendererCapability(id, 'chatUi')`, `ctx.ipc.publish`,
  `SETTINGS_PAGE_ORDER.chat`, `ShellSlots.statusbarRight`.
