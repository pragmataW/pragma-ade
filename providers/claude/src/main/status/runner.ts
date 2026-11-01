import { RUN_AS_NODE_ENV, RUNNER_FILE, WIN32 } from './constants'

const SINGLE_QUOTE = "'"
const ESCAPED_SINGLE_QUOTE = `'\\''`

/** POSIX single-quoting: `a b'c` → `'a b'\''c'`. */
export const shellQuote = (s: string): string =>
  `${SINGLE_QUOTE}${s.split(SINGLE_QUOTE).join(ESCAPED_SINGLE_QUOTE)}${SINGLE_QUOTE}`

/**
 * A tiny per-session script that runs the bundled hook with the app's own runtime (Electron as Node), so no `node`
 * on PATH is needed. The win32 variant is unverified (Windows runtime is not tested in v1).
 */
export function runnerSource(o: { execPath: string; scriptPath: string; platform: NodeJS.Platform }): {
  fileName: string
  contents: string
} {
  if (o.platform === WIN32)
    return {
      fileName: RUNNER_FILE.win32,
      contents: `@echo off\r\nset ${RUN_AS_NODE_ENV}=1\r\n"${o.execPath}" "${o.scriptPath}" %*\r\nexit /b 0\r\n`,
    }
  return {
    fileName: RUNNER_FILE.posix,
    contents: `#!/bin/sh\n${RUN_AS_NODE_ENV}=1 exec ${shellQuote(o.execPath)} ${shellQuote(o.scriptPath)} "$@"\n`,
  }
}

/** The hook `command` Claude runs through its shell. */
export function hookCommand(runnerPath: string, event: string, platform: NodeJS.Platform): string {
  return platform === WIN32 ? `"${runnerPath}" ${event}` : `${shellQuote(runnerPath)} ${event}`
}
