# Bridge server (`@pragma/module-bridge`)

A local, token-protected HTTP + WebSocket server. External processes (agent hooks, the VS Code bridge extension in 06,
the `pragma` CLI in 10) use it to talk to the running app. Modules add **namespaces**; the bridge itself knows nothing
about agents, editors or tasks.

## Protocol

Every message is a JSON envelope:

```json
{ "type": "<namespace>.<name>", "id": "optional request id", "payload": {} }
```

- `type` matches `/^[a-z][a-z0-9-]*\.[A-Za-z][A-Za-z0-9.-]*$/`; it is split at the first `.` (`editor.open.file` →
  namespace `editor`, name `open.file`).
- Answers are `{ "type": "bridge.result", "id", "payload" }` or
  `{ "type": "bridge.error", "id", "error": { "code", "message" } }` with `code` one of `unauthorized`, `bad_request`,
  `unknown_type`, `invalid_payload`, `handler_error`, `timeout`, `payload_too_large`.
- The namespace `bridge` is reserved (`bridge.hello`, `bridge.subscribe`, `bridge.ping`).

## Endpoints and auth

The server listens on `127.0.0.1` on a free port. The token is 32 random bytes (base64url), new on every app start.

| Endpoint | Auth | Notes |
|---|---|---|
| `POST /hook` | `Authorization: Bearer <token>` | One envelope per request → `200` + result. `401` bad token, `400` non-JSON or bad envelope, `413` body over 1 MiB, `404`/`405` other paths/methods. |
| `GET /ws` (upgrade) | Bearer header **or** the token in `bridge.hello` | The first message must be `bridge.hello { token, client: { kind, name?, version? }, subscribe: [] }` within 5 s, otherwise `bridge.error unauthorized` + close `4401`. Envelopes with `id` get a result; without `id` they are fire-and-forget. |

Every request and upgrade must carry `Host: 127.0.0.1:<port>` or `localhost:<port>` (`421` otherwise, DNS rebinding)
and no `Origin` other than `null` (`403`, browsers).

## `bridge.json`

`<userData>/bridge.json`, mode `0600`, written atomically on start and removed on quit (only if it still holds this
instance's token):

```json
{ "version": 1, "url": "http://127.0.0.1:53123", "wsUrl": "ws://127.0.0.1:53123/ws", "token": "…", "pid": 123, "startedAt": "…" }
```

## Adding a namespace (other modules)

1. Define it in your contract with `defineBridgeNamespace({ name, requests: { x: { input, output } }, events: { e: schema } })`.
2. In `activate`, list `bridge` in `dependsOn` (or `optionalDependsOn` and `tryGet`) and register:

```ts
const bridge = ctx.services.get(BridgeServerToken)
const dispose = bridge.registerHandler(myNamespace, { x: (payload, reqCtx) => ({ ok: true }) })
// keep `dispose` and call it in deactivate
bridge.broadcast(myNamespace, { name: 'e', payload: { … } }) // to WS clients subscribed to the namespace
```

Inputs are validated against the request schema (`invalid_payload`), outputs against the output schema
(`handler_error`), thrown errors become `handler_error` with the message only.

## Client library (`@pragma/module-bridge/client`, Node)

- `readBridgeInfo({ env?, userDataDirs?, platform?, home? })` → `{ url, token, wsUrl, source }`. Order:
  `PRAGMA_BRIDGE_URL` + `PRAGMA_BRIDGE_TOKEN` → `PRAGMA_BRIDGE_FILE` → `$PRAGMA_USER_DATA/bridge.json` → the SDK's
  `defaultUserDataDirs`. Missing everywhere or invalid → `BridgeUnavailableError('no_config')`.
- `postBridgeMessage({ url, token }, { type, payload }, { timeoutMs })` → result payload. `BridgeUnavailableError`
  (`unauthorized` | `unreachable`, 3 s default timeout) or `BridgeRequestError(code)`. `http.ts` and `errors.ts` import
  only `contract/constants.ts`, so hook bundles stay small and zod-free.
- `createBridgeClient({ connection, client, subscribe?, WebSocket?, requestTimeoutMs?, reconnect? })`: `ready()`,
  `request(ns, name, payload)` (typed), `requestRaw`, `notify`, `on(ns, event, cb)`, `onRaw`, `onStateChange`, `close()`.
  Pass `WebSocket` from `ws` where there is no global one (and to send the Authorization header). Reconnect re-sends
  hello with every subscribed namespace; a `4401` close ends in `closed` without reconnecting.

06 uses `createBridgeClient`; 10 uses `readBridgeInfo` + `postBridgeMessage`.

## Testing

`@pragma/module-bridge/testing`: `startTestBridgeServer({ token?, port? })` → a real server plus `connection` and an
`infoDir` holding its `bridge.json`.

## Security notes

Loopback only, a fresh token per start compared in constant time, Host/Origin checks, 1 MiB body limit, a 0600 info
file. The token never appears in logs.
