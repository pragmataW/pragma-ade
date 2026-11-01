import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { join } from 'node:path'

/** Absolute path of the generic activity agent (executable script). */
export const activityAgentPath = join(import.meta.dirname, 'activity-agent.mjs')

const FAKE_WAIT_MS = 10_000
const POLL_MS = 20

export interface SpawnedFake {
  child: ChildProcessWithoutNullStreams
  output(): string
  send(line: string): void
  waitForOutput(text: string, timeoutMs?: number): Promise<void>
  exited: Promise<number | null>
}

/** Spawns a fake agent script with `node` (shared by the agent-status and provider fake tests). */
export function spawnFake(path: string, args: string[] = [], env: Record<string, string> = {}): SpawnedFake {
  const child = spawn(process.execPath, [path, ...args], { env: { PATH: process.env.PATH ?? '', ...env } })
  let out = ''
  child.stdout.on('data', (d) => {
    out += String(d)
  })
  const exited = new Promise<number | null>((resolve) => child.on('close', (code) => resolve(code)))
  return {
    child,
    output: () => out,
    send: (line) => child.stdin.write(`${line}\n`),
    async waitForOutput(text, timeoutMs = FAKE_WAIT_MS) {
      const deadline = Date.now() + timeoutMs
      while (!out.includes(text)) {
        if (Date.now() > deadline) throw new Error(`fake ${path}: no "${text}" in ${timeoutMs} ms; output: ${out}`)
        await new Promise((r) => setTimeout(r, POLL_MS))
      }
    },
    exited,
  }
}
