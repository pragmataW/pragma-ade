import { chmod, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Env the fake binary reads (all optional). */
export const FAKE_ASK_ENV = {
  /** File the fake writes `{ argv, stdin, cwd, env }` to. */
  record: 'FAKE_ASK_RECORD',
  stdout: 'FAKE_ASK_STDOUT',
  stderr: 'FAKE_ASK_STDERR',
  exit: 'FAKE_ASK_EXIT',
  sleepMs: 'FAKE_ASK_SLEEP_MS',
  /** Set: spawn a sleeping grandchild and write its pid to this file. */
  childPidFile: 'FAKE_ASK_CHILD_PID',
} as const

export interface FakeAskRecord {
  argv: string[]
  stdin: string
  cwd: string
  env: Record<string, string>
}

const script = (): string => `#!${process.execPath}
const fs = require('node:fs')
const { spawn } = require('node:child_process')
const env = process.env
const chunks = []
process.stdin.on('data', (c) => chunks.push(c))
process.stdin.on('end', () => {
  const stdin = Buffer.concat(chunks).toString()
  if (env.${FAKE_ASK_ENV.record})
    fs.writeFileSync(env.${FAKE_ASK_ENV.record}, JSON.stringify({ argv: process.argv.slice(2), stdin, cwd: process.cwd(), env }))
  if (env.${FAKE_ASK_ENV.childPidFile}) {
    const c = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' })
    c.unref()
    fs.writeFileSync(env.${FAKE_ASK_ENV.childPidFile}, String(c.pid))
  }
  setTimeout(() => {
    if (env.${FAKE_ASK_ENV.stdout}) process.stdout.write(env.${FAKE_ASK_ENV.stdout})
    if (env.${FAKE_ASK_ENV.stderr}) process.stderr.write(env.${FAKE_ASK_ENV.stderr})
    process.exitCode = Number(env.${FAKE_ASK_ENV.exit} || 0)
  }, Number(env.${FAKE_ASK_ENV.sleepMs} || 0))
})
`

/** Writes an executable fake agent CLI into `dir` (POSIX: a node script with an absolute shebang). */
export async function writeFakeAskBin(dir: string, name = 'fake-agent'): Promise<string> {
  const path = join(dir, name)
  await writeFile(path, script())
  await chmod(path, 0o755)
  return path
}
