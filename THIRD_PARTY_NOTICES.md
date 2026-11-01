# Third-party notices

Code copied from third-party projects keeps its original license header and is listed here. Phases append entries only.

| Source | License | Files |
|---|---|---|
| [shadcn/ui](https://github.com/shadcn-ui/ui) | MIT | `packages/ui/src/vendor/*` (generated with the shadcn CLI 4.23.0) |
| [stablyai/orca](https://github.com/stablyai/orca) | MIT | `modules/browser/src/main/navigation-policy.ts`, `modules/browser/src/main/picker/page/{selector,collect,overlay,react-probe}.ts`, `modules/browser/src/main/picker/capture.ts` (phase 08, adapted) |

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
