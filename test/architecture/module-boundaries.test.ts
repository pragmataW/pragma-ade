import { describeRule } from './lib/arch-test.ts'

describeRule('module-boundaries', [
  ['apps/desktop/src/main/bad.ts', 1],
  ['modules/bad-import/src/main/client-user.ts', 1],
  ['modules/bad-import/src/main/index.ts', 1],
  ['modules/bad-import/src/main/index.ts', 2],
  ['modules/bad-import/src/main/index.ts', 3],
  ['modules/bad-renderer-node/src/renderer/index.tsx', 1],
  ['providers/claude/src/main/foreign-sub.ts', 1],
])
