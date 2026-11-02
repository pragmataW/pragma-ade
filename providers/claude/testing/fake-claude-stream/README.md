# fake-claude (stream-json)

A fake `claude` that speaks the Claude Agent SDK `stream-json` protocol from a scripted scenario. Used by the 11a unit
tests (real SDK `query()` against this process) and the chat E2E tests. Derived from Orca's
`claude-agent-sdk-scripted-cli.mjs` (MIT, see `THIRD_PARTY_NOTICES.md`).

- `fake-claude` — executable (`#!/usr/bin/env node`), imports `impl.mjs`. `--version` prints a version and exits.
- `scenario.ts` — typed builders (`basicScenario`, `toolEditPermissionScenario`, …); `scenarios/*.json` are generated
  from them (`node scenario.ts`, then `biome check --write`) and a unit test keeps them in sync.

## Environment

| Variable | Meaning |
|---|---|
| `FAKE_CLAUDE_SCENARIO` | scenario JSON path |
| `FAKE_CLAUDE_REPORT` | JSONL file; one full report line per state change (`argv`, `cwd`, `env` (HOME, CLAUDE_CONFIG_DIR, PATH, FAKE_*, PRAGMA_*, PROFILE_*), `sessionId`, `userMessages[{at, frame}]`, `controlRequests`, `controlResponses`, `results[{at, subtype}]`) |
| `FAKE_CLAUDE_TIMEOUT_MS` | lifetime bound (default 600000) |

## Scenario

`{ protocol?: false, init?: { commands, models }, preamble?: Step[], turns: Step[][] }`. The preamble runs at start;
each turn waits for the next `user` frame. `system/init` (with `session_id` from `--session-id`/`--resume`) precedes
the first turn's frames. A user frame after the last turn gets a one-line answer.

`mcpServers` answers `mcp_status` (names and states also go into `system/init`). With `--replay-user-messages` every
user frame is echoed back with `isReplay: true` on arrival; `result.queued_turn_count` counts user frames still waiting.

Steps (`emitText`, `emitThinking`, `emitToolUse`, `emitToolResult` take `parentToolUseId` for subagent output): `emit`, `emitText {messageId, text, chunks, chunkDelayMs?}`, `emitThinking`, `emitToolUse {messageId, id, name,
input}`, `emitToolResult {toolUseId, content, isError?, toolUseResult?}`, `requestPermission {requestId, toolName,
input, toolUseId, suggestions?}` (waits for the matching `control_response`), `awaitInterrupt`, `result {subtype?,
costUsd?, contextWindow?, errors?}`, `stdoutRaw`, `stderr`, `delayMs`, `exit`.

Control requests: `initialize` is answered with `init` (never when `protocol: false`); `mcp_status` with
`mcpServers`; `rewind_files` with `canRewind: true`; `interrupt` ends the current
turn (with an `error_during_execution` result unless the turn is in `awaitInterrupt`); everything else (`set_model`,
`set_permission_mode`, `apply_flag_settings`, …) gets a success reply and is recorded.

The transcript is appended to `$CLAUDE_CONFIG_DIR/projects/<cwd with non-alphanumerics as ->/<session>.jsonl` with an
intact `parentUuid` chain; `--resume` appends to the same file.
