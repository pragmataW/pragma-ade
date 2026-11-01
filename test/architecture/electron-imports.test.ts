import { describeRule } from './lib/arch-test.ts'

describeRule('electron-imports', [['modules/bad-electron/src/main/index.ts', 2]])
