import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { generateRegistry } from './gen-modules.ts'
import {
  DEFAULT_MODULE_ROOTS,
  DESKTOP_APP_DIR,
  E2E_BUILDS,
  ELECTRON_VITE_BIN,
  EXTENSION_PROOF_ROOTS,
  PARENT_DIR,
  STDIO_INHERIT,
  WIN32,
} from './lib/constants.ts'
import { GenerateError } from './lib/errors.ts'

/**
 * Builds the two E2E variants: the extension-proof build (default roots + the fixture roots) into
 * `apps/desktop/out-extension-proof`, then the default build into `apps/desktop/out`. The default
 * registry is generated last so the working tree ends up with the normal generated files.
 */
function buildE2e(repoRoot: string): void {
  const desktop = join(repoRoot, DESKTOP_APP_DIR)
  for (const b of E2E_BUILDS) {
    const roots = b.extensionProof ? [...DEFAULT_MODULE_ROOTS, ...EXTENSION_PROOF_ROOTS] : undefined
    const result = generateRegistry({ repoRoot, roots })
    console.log(`build-e2e[${b.name}]: ${result.modules.length} modules/providers`)
    const run = spawnSync(join(desktop, ELECTRON_VITE_BIN), ['build', '--outDir', b.outDir], {
      cwd: desktop,
      stdio: STDIO_INHERIT,
      shell: process.platform === WIN32,
    })
    if (run.status !== 0) process.exit(run.status ?? 1)
  }
}

try {
  buildE2e(resolve(import.meta.dirname, PARENT_DIR))
} catch (error) {
  if (!(error instanceof GenerateError)) throw error
  for (const p of error.problems) console.error(`  ✗ ${p}`)
  process.exit(1)
}
