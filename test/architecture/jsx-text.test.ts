import { describeRule } from './lib/arch-test.ts'

describeRule('jsx-text', [
  ['modules/bad-text/src/renderer/index.tsx', 3],
  ['modules/bad-text/src/renderer/index.tsx', 4],
  ['modules/bad-text/src/renderer/index.tsx', 5],
])
