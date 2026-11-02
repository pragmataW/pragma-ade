import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from '@playwright/test'
import { SMOKE_RESULTS_FILE, SMOKE_TARGETS, SMOKE_TEST_TIMEOUT_MS, smokeDist } from './support/constants'

/** Smoke tests of the packaged macOS app (phase 12): `node scripts/package/cli.ts smoke`. */
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.pkg.ts',
  workers: 1,
  retries: 0,
  timeout: SMOKE_TEST_TIMEOUT_MS,
  reporter: [['list'], ['json', { outputFile: join(smokeDist(), SMOKE_RESULTS_FILE) }]],
  // outside dist/: Biome scans dist/ (scripts/package/RECON.md)
  outputDir: join(tmpdir(), 'pragma smoke test-results'),
  projects: SMOKE_TARGETS.map((target) => ({ name: target, metadata: { target } })),
})
