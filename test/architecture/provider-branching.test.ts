import { describeRule } from './lib/arch-test.ts'

describeRule('provider-branching', [
  ['modules/bad-branching/src/main/index.ts', 2],
  ['modules/bad-branching/src/main/index.ts', 5],
])
