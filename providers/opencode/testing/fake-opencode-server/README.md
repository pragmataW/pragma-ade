# Fake OpenCode 2.x `serve` (test fixture, phase 11b)

`node bin.mjs [prefix args…] serve [--stdio] [--hostname H] [--port P]` behaves like `opencode serve` 2.x for the
routes the chat adapter uses (`/api/info`, `/api/model[/default]`, `/api/agent`, `/api/command`, `/api/session/**`,
`/api/event` SSE). `--version` prints `opencode v<scenario.version>`. Node built-ins only.

- **Ready / lease:** `--stdio` prints one line `{"url":"http://127.0.0.1:<port>"}` and exits 0 when stdin closes.
- **Auth:** `OPENCODE_SERVER_PASSWORD` (or `OPENCODE_PASSWORD`), `Authorization: Basic base64("opencode:<pw>")`,
  else 401.
- **Env:** `FAKE_OPENCODE_SCENARIO` (JSON), `FAKE_OPENCODE_LOG` (JSONL: `start`, `request`, `form-cancel`; the
  `authorization` header is never logged), `FAKE_OPENCODE_LOG_ENV` (comma-separated names recorded in `start.env`),
  `FAKE_OPENCODE_STATE_DIR` (sessions + messages survive restarts), `FAKE_OPENCODE_TEST_ROUTES=1`
  (`POST /__test/drop-sse`), `FAKE_OPENCODE_MODE`: `normal`, `no-ready`, `exit-early` (stderr `boom`, exit 3),
  `legacy-1x` (1.x ready line, only `/global/health`, `--version` → `1.1.36`), `version:<v>`, `die-after-ms:<n>`,
  `ignore-lease` (ignores stdin end and SIGTERM).
- **Scenarios** (`scenarios/*.json`): `{version, models, defaultModel, agents, commands, turns}`; a turn is
  `{steps: ({emit:{type,data}} | {sleepMs} | {awaitPermission} | {awaitForm})[]}` with placeholders `$SID`, `$AMID`.
  Each prompt/command emits `session.inbox.enqueued` + `session.execution.started`, then plays the next turn
  (cyclic). Turns are stored as v2 messages (`user`, `assistant` with `content[]`, `idle` with `outcome`).

Shared test helpers: `harness.ts` (Vitest) and `paths.ts` (no test-runner imports; Playwright).
