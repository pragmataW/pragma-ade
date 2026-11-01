import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: [
    'apps/*/e2e/**/*.e2e.ts',
    'packages/*/e2e/**/*.e2e.ts',
    'modules/*/e2e/**/*.e2e.ts',
    'providers/*/e2e/**/*.e2e.ts',
    'test/**/e2e/**/*.e2e.ts',
  ],
  testIgnore: ['**/node_modules/**', '**/fixtures/violations/**'],
  workers: 1,
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results',
  use: { trace: 'retain-on-failure' },
})
