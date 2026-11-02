import { join, resolve } from 'node:path'

export const REPO_ROOT = resolve(import.meta.dirname, '../../../..')
/** `dist/` of the repo the packages were built from (`cli.ts smoke --repo` sets it). */
export const SMOKE_DIST_ENV = 'PRAGMA_SMOKE_DIST'
export const smokeDist = (): string => process.env[SMOKE_DIST_ENV] || join(REPO_ROOT, 'dist')
export const SMOKE_TARGETS = ['darwin-arm64', 'darwin-x64'] as const
export type SmokeTarget = (typeof SMOKE_TARGETS)[number]
export const SMOKE_TEST_TIMEOUT_MS = 180_000
export const SMOKE_LAUNCH_TIMEOUT_MS = 60_000
export const BRIDGE_TIMEOUT_MS = 30_000
export const TERMINAL_TIMEOUT_MS = 30_000
export const QUIT_TIMEOUT_MS = 20_000
export const SMOKE_ECHO = 'echo PRAGMA_SMOKE_$((40+2))'
export const SMOKE_EXPECT = 'PRAGMA_SMOKE_42'
export const UNAUTHORIZED = 401
export const PRODUCT_NAME = 'Pragma ADE'
export const EXECUTABLE_NAME = 'pragma-ade'
export const SMOKE_RESULTS_FILE = 'smoke-results.json'
