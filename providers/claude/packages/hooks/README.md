# `@pragma/provider-claude-hooks`

The Claude Code status hook, bundled into `dist/pragma-hook.mjs` (`pnpm --filter @pragma/provider-claude-hooks build`,
run automatically by `pragma.build`). Shipped as the provider resource `hooks/pragma-hook.mjs`.

- Invocation: `<runner> <EventName>` with the hook JSON on stdin. The runner (written per session by the `status`
  capability) runs Electron as Node (`ELECTRON_RUN_AS_NODE=1`).
- Forwards only `hook_event_name`, `session_id`, `notification_type`, `tool_name`, `source` and `reason`
  (≤ 200 chars each) as `agent.hookEvent` to the bridge in `PRAGMA_BRIDGE_URL` / `PRAGMA_BRIDGE_TOKEN`.
- Never prints, never fails: without the env it exits at once; a down bridge times out after 2 s; exit code is 0.
