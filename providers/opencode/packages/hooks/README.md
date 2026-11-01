# `@pragma/provider-opencode-hooks`

The OpenCode 2.x status plugin, bundled into `dist/plugin/index.js` (`pragma.build`). OpenCode 2.x loads plugins only
from **directories**, so the provider resource is the directory `hooks/plugin`.

- Default export `{ id: 'pragma-status', setup(ctx) }`. `setup` does nothing unless `PRAGMA_BRIDGE_URL`,
  `PRAGMA_BRIDGE_TOKEN` and `PRAGMA_SESSION_ID` are set, and only the first instance in a process tree reports
  (`PRAGMA_STATUS_CLAIMED`).
- Sends `pragma.ready`, then forwards mapped bus events (`./records`: `createRecordMapper`, `OPENCODE_EVENT_TYPES`)
  in order. Subagent sessions are filtered, except their permission/form prompts (`child: true`).
- Resubscribes 1 s after the event stream ends or fails; the returned cleanup aborts it.

Design of the subscribe loop, child filter and send queue follows `onurravli/voltran` (Apache-2.0); see
`THIRD_PARTY_NOTICES.md`.
