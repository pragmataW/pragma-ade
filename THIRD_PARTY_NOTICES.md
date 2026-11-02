# Third-party notices

Code copied from third-party projects keeps its original license header and is listed here. Phases append entries only.

| Source | License | Files |
|---|---|---|
| [shadcn/ui](https://github.com/shadcn-ui/ui) | MIT | `packages/ui/src/vendor/*` (generated with the shadcn CLI 4.23.0) |
| [stablyai/orca](https://github.com/stablyai/orca) | MIT | `modules/browser/src/main/navigation-policy.ts`, `modules/browser/src/main/picker/page/{selector,collect,overlay,react-probe}.ts`, `modules/browser/src/main/picker/capture.ts` (phase 08, adapted) |
| [onurravli/voltran](https://github.com/onurravli/voltran) | Apache-2.0 | `providers/opencode/packages/hooks/src/{plugin,records}.ts` (subscribe loop, child-session filter and event mapping adapted from `packages/daemon/src/opencode-plugin/index.ts`) |
| [simple-icons/simple-icons](https://github.com/simple-icons/simple-icons) — Claude mark | CC0-1.0 (collection); the mark is a trademark of Anthropic, PBC | `providers/claude/src/renderer/icon.tsx` (SVG path, brand colour `#D97757`) |
| [anomalyco/opencode](https://github.com/anomalyco/opencode) — OpenCode mark | MIT; the OpenCode name and mark are trademarks of their owner | `providers/opencode/src/renderer/icon.tsx` (shapes and colours of `mark.svg` / `mark-light.svg`) |

## stablyai/orca — MIT License

Adapted in `modules/browser` (phase 08):

- `src/main/navigation-policy.ts` ← `src/main/browser/browser-external-app-launch.ts`
- `src/main/picker/page/selector.ts`, `src/main/picker/page/collect.ts` ← `src/main/browser/grab-guest-element-context-script.ts`
- `src/main/picker/page/overlay.ts` ← `src/main/browser/grab-guest-overlay-script.ts`
- `src/main/picker/page/react-probe.ts` ← `src/main/browser/grab-guest-react-script.ts`
- `src/main/picker/capture.ts` ← `src/main/browser/browser-grab-screenshot.ts`

```text
MIT License

Copyright (c) 2026 Lovecast Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Agent logos (Claude, OpenCode)

The provider marks are the vendors' own logos, used unmodified (shapes and colours) only to identify the agent each profile launches. Pragma ADE is not affiliated with or endorsed by Anthropic or the OpenCode authors.

- **Claude** — `providers/claude/src/renderer/icon.tsx` holds the path of [`icons/claude.svg`](https://github.com/simple-icons/simple-icons/blob/7a6199a2ac7d20b529f863b6aceb20d2c6529207/icons/claude.svg) from simple-icons (16.36.0; data entry `{"title":"Claude","hex":"D97757","source":"https://claude.ai"}`), drawn in the brand orange `#D97757`. simple-icons is released under CC0-1.0, but its [DISCLAIMER](https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md) notes that this does not cover the brands themselves: Claude and the Claude mark are trademarks of Anthropic, PBC, and their use follows Anthropic's brand guidelines (no alteration, no implied endorsement).
- **OpenCode** — `providers/opencode/src/renderer/icon.tsx` redraws [`packages/identity/mark.svg`](https://github.com/anomalyco/opencode/blob/3f5bb21f163a95f5fe8f354875b1157d7f66137d/packages/identity/mark.svg) (dark: tile `#131010`, inner `#5A5858`, frame white) and [`mark-light.svg`](https://github.com/anomalyco/opencode/blob/3f5bb21f163a95f5fe8f354875b1157d7f66137d/packages/identity/mark-light.svg) (light: tile `#FDFCFC`, inner `#E6E5E6`, frame `#17181C`) from the official repository (formerly sst/opencode; brand assets also at https://opencode.ai). The repository is MIT-licensed (Copyright (c) 2025 opencode); the OpenCode name and mark remain trademarks of their owner.

## Phase 06 — editor (no code copied)

- VSCodium `reh-web` 1.143.17232 (MIT) — downloaded at first use into `<userData>/editor/<version>`, not bundled — https://github.com/VSCodium/vscodium
- node-tar 7.5.22 (BlueOak-1.0.0) — npm dependency of `modules/editor` (archive extraction)
- yazl 3.3.1 (MIT) — dev dependency of `modules/editor/packages/bridge-extension` (packs `pragma-bridge.vsix`)
- `modules/editor/e2e/support/bracketed-paste.plugin.mjs` is a copy of phase 08's own test plugin (same repository, no external license)

## stablyai/orca — MIT License (phase 11a, chat)

Same license text and copyright (Lovecast Inc.) as above. Derived files (each keeps a header naming its source and
"Modified for Pragma ADE"):

- `providers/claude/src/main/chat/spawn.ts` ← `src/main/claude/claude-agent-sdk-process-spawn.ts`
- `providers/claude/src/main/chat/user-input.ts` ← `src/main/claude/claude-agent-sdk-user-message-queue.ts`
- `providers/claude/src/main/chat/env.ts` ← `src/main/claude/claude-child-process-environment.ts` (stripped env list)
- `providers/claude/testing/fake-claude-stream/impl.mjs` ← `src/main/claude/__fixtures__/claude-agent-sdk-scripted-cli.mjs`

## Runtime dependencies added in phase 11a

| Package | License | Used by |
|---|---|---|
| `@anthropic-ai/claude-agent-sdk` 0.3.316 | Anthropic Commercial Terms (see its README) | `providers/claude` (chat capability) |
| `@pierre/diffs` 1.6.2 | Apache-2.0 | `modules/chat` (inline diffs; already used by 07) |
| `@tanstack/react-virtual` 3.14.24 | MIT | `modules/chat` (message list) |
