# _template — `@pragma/module-example`

Reference module (id `example`). The leading `_` keeps it out of the generated registry, so it never ships; copy the folder to start a new module and follow the rules in [AGENTS.md](../../AGENTS.md).

It shows, in the smallest form that still follows the code-quality rules (§9, §10):

- `src/constants.ts` — every literal (ids, channels, commands, shortcut, tab order, sizes).
- `src/contract/` — zod schemas (all types are `z.infer`), IPC contracts (`ExampleIpc.hello`, the `itemAdded` event), the service token, a main-process event and `TEST_IDS`.
- `src/lib/greeting.ts` — pure logic, unit-tested with `it.each`.
- `src/main/` — drizzle table (`schema.ts`), service, IPC handlers and `index.ts` (settings, `migrations: true`, an `app`-scoped `CmdOrCtrl+Alt+E` shortcut).
- `src/renderer/` — right tab with a badge driven by `itemAdded`, a settings page (order 1001), the palette command `example.sayHello`, logic in `use-example-greeting.ts`.
- `migrations/0001_example_items.sql` — migration numbers are per module.
- `test/` — runs the real main host in-process with `@pragma/test-support`.

Run its tests alone with `pnpm --filter @pragma/module-example test`.
