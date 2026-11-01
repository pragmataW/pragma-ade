import { describeRule } from './lib/arch-test.ts'

describeRule('i18n-keys', [
  ['modules/bad-i18n/src/renderer/index.tsx', 3],
  ['modules/bad-i18n/src/renderer/index.tsx', 4],
])
