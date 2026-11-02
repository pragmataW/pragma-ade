import { defineConfig } from 'vitest/config'
import { INT_TEST_TIMEOUT_MS, UNIT_TEST_TIMEOUT_MS } from './constants.ts'

export default defineConfig({
  test: {
    root: import.meta.dirname,
    projects: [
      { test: { name: 'unit', include: ['test/**/*.unit.ts'], testTimeout: UNIT_TEST_TIMEOUT_MS } },
      {
        test: { name: 'int', include: ['test/**/*.int.ts'], testTimeout: INT_TEST_TIMEOUT_MS, fileParallelism: false },
      },
    ],
  },
})
