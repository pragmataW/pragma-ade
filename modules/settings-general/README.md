# settings-general

Core module (`core: true`) that owns the general settings section `settings-general`:

- **General** — interface language (`language`).
- **Appearance** — mode (dark / light / system), palette (VS Code, Dark Brown, Amber, Indigo) and density (compact / comfortable). Main applies them through the shell's `ThemeControllerToken`; every module reads the result with `ctx.theme`.
- **Modules** — every module and provider from `core.modules.list` with state, reason and dependencies; switches call `core.modules.setEnabled` and a restart bar calls `core.app.relaunch`.
- **Keyboard shortcuts** — read-only list of `core.shortcuts.list`.

It also adds the quick dark/light toggle to the `titlebar.right` slot.

## Contract

`@pragma/module-settings-general/contract` exports `GeneralSettingsSchema`, `GeneralSettings`, `GENERAL_SETTINGS_DEFAULTS` and `TEST_IDS` (for other phases' E2E tests). Other modules must not write this section; they read the theme through `ctx.theme`.
