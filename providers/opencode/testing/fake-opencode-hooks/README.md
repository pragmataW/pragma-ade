# fake-opencode-hooks

A fake `opencode` 2.x for status tests (phase 04). Exits 2 unless `--standalone` is in argv (like our launches),
loads each plugin directory listed in `OPENCODE_CONFIG_CONTENT.plugins` (`<dir>/index.js`, default `{ id, setup }`) and
calls `setup({ event: { subscribe } })`.

- stdin lines: `oc <type> <json-data>` (pushed to every subscription as `{ type, data }`, then waits 100 ms),
  `say <text>`, `exit`.
- `FAKE_AGENT_LOG` gets a JSONL `start` entry with argv.
- TS helper: `providers/opencode/testing/fake-opencode-hooks.ts` (`fakeOpencodeHooksPath`).
