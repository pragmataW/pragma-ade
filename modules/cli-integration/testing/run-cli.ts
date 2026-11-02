import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { RESOURCE_PATHS } from '../src/constants'

/** The bundled CLI (`pragma.build` writes it before tests and E2E builds). */
export const CLI_BUNDLE_PATH = join(import.meta.dirname, '..', RESOURCE_PATHS.bundle)
const RUN_TIMEOUT_MS = 20_000

export interface CliRun {
  code: number
  stdout: string
  stderr: string
}

/**
 * Runs `node <bundle> …args` with ONLY `PATH` from this process plus `env` (no bridge vars leak in from the caller).
 * Pass `HOME` and `PRAGMA_USER_DATA` or `PRAGMA_BRIDGE_FILE` to pick the app instance.
 */
export function runCli(args: string[], env: Record<string, string>): Promise<CliRun> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_BUNDLE_PATH, ...args], {
      env: { PATH: process.env.PATH ?? '', ...env },
      timeout: RUN_TIMEOUT_MS,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString()
    })
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }))
  })
}
