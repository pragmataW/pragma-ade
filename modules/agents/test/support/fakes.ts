import { spawn } from 'node:child_process'
import type { LaunchContext, LaunchDecorator, LaunchSpec } from '../../src/contract'
import { fakeAgentScript } from '../../testing'

/** Shared unit-test fakes (§9: no copy-pasted setup). */

/** A `writeTempFile` recorder; returns `path` (default `/tmp/s/<name>`). */
export function fakeWriter(path?: string) {
  const calls: [string, string][] = []
  return {
    calls,
    async writeTempFile(name: string, contents: string): Promise<string> {
      calls.push([name, contents])
      return path ?? `/tmp/s/${name}`
    },
  }
}

/** Runs the fake agent with piped stdio; resolves with its stdout and exit code. */
export function spawnFakeAgent(args: string[], opts: { env?: Record<string, string>; cwd?: string; stdin?: string }) {
  const child = spawn(process.execPath, [fakeAgentScript(), ...args], {
    stdio: 'pipe',
    cwd: opts.cwd,
    env: { PATH: process.env.PATH ?? '', ...opts.env },
  })
  let stdout = ''
  child.stdout.setEncoding('utf8').on('data', (d: string) => {
    stdout += d
  })
  if (opts.stdin !== undefined) child.stdin.end(opts.stdin)
  const exited = new Promise<number | null>((resolve) => child.on('exit', (code) => resolve(code)))
  return { child, exited, stdout: () => stdout }
}

/** A logger that records warnings and errors (and their details). */
export function recordingLog() {
  const lines: { level: string; message: string }[] = []
  const at = (level: string) => (message: string) => void lines.push({ level, message })
  const log = { debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error'), child: () => log }
  return Object.assign(log, { lines, warnings: () => lines.filter((l) => l.level === 'warn').map((l) => l.message) })
}

/** A decorator from a function. */
export const decorator = (
  id: string,
  order: number,
  decorate: (spec: LaunchSpec, ctx: LaunchContext) => LaunchSpec | Promise<LaunchSpec>,
): LaunchDecorator => ({ id, order, decorate: async (spec, ctx) => decorate(spec, ctx) })
