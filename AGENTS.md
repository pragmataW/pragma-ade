# Pragma ADE — agent guide

## Read first
- `docs/phases/CONVENTIONS.md` — the binding architecture contract. §10 wins over earlier sections.
- `docs/phases/README.md` — workflow, Definition of Done, test rules, allowed licenses.
- `docs/modules.md` — how to write a module or provider with `@pragma/sdk`.
- `docs/design/ui-notes.md` — approved UI: tokens, layout, components.
- Your phase plan in `docs/plans/` (plan + contract win over the older phase docs).

## Architecture in 10 lines
1. Thin Electron shell (`apps/desktop`) + module SDK (`@pragma/sdk`) + modules (`modules/<id>`) and providers (`providers/<id>`).
2. `scripts/gen-modules.ts` discovers modules from `package.json` `pragma` manifests into a gitignored registry.
3. Adding a feature = adding a folder; never edit the shell, SDK or another module for it.
4. Import other modules only through `/contract`, `/renderer` (renderer code), `/client` and `/testing` (tests).
5. Runtime coupling goes through services, events, commands, slots and typed IPC.
6. No `if`/`switch` on provider ids outside `providers/`; use capabilities.
7. Renderer code never imports Node builtins or `electron`.
8. Main-side modules may import only `WebContentsView`, `webContents`, `session`, `protocol`, `net` from `electron`.
9. Dialogs, notifications, external links, shortcuts, theme and shell env come from SDK platform APIs.
10. Every user-visible string is an i18n key.

## File ownership
- Each file belongs to exactly one phase (CONVENTIONS §3). Edit only files your phase owns.
- Root configs, `apps/desktop`, `packages/*`, `scripts/gen-modules.ts`, `test/architecture` belong to phase 00.
- Need a change elsewhere? Use the owner's extension point, or record it under "Contract issues" in your plan.

## Code quality (§9)
- No duplicated logic (jscpd, 50 tokens, zero clones; tests included).
- No repeated literals and no magic numbers outside `src/constants.ts` (`scripts/check-literals.ts`).
- `data-testid` values shared with other modules live in `src/contract/testids.ts`.
- Types come from zod (`z.infer`); enum-like values are `as const` arrays.
- No `any`; `switch` ends with a `never` check; cognitive complexity ≤ 12.
- Exceptions only as `// lint-allow: <rule> — <reason>`, listed in the phase report.

## i18n
- Keys are `<namespace>:<section>.<key>`; namespace = module id (`core` for the shell).
- Modules: `locales/en.json`. Providers: `locales/en/<capability>.json`. Only English in v1.
- Text sent to agents and CLI output is fixed English, outside i18n.

## Commands
- `pnpm lint` — Biome + jscpd + literal check + architecture tests.
- `pnpm typecheck` — `tsc` for node and web configs.
- `pnpm test` — Vitest (node + jsdom projects).
- `pnpm e2e` — Playwright `_electron` against a fresh build.
- `pnpm dev` — run the app; `pnpm gen` — regenerate the module registry.

## Tests
- TDD: failing test, implementation, passing test.
- Always use temp userData (`PRAGMA_USER_DATA`), temp fixture repos and temp HOME/config dirs.
- Never touch the real `~/.claude`, `~/.config/opencode`, VS Code settings or real projects.
- Tag real agent runs `@real-agent` (excluded from `pnpm e2e`); network tests `@network`.

## Git
- One branch per phase: `phase/NN-<name>`, merged into `main` when done. No remote, no push.
- One commit per task, Conventional Commits.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
