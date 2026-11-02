import { spawn } from 'node:child_process'
import { STDERR_TAIL_CHARS, STREAM_EVENT, UTF8 } from '../constants.ts'

export interface RunOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  allowFail?: boolean
  timeoutMs?: number
  onLine?: (line: string) => void
}

export interface RunResult {
  code: number
  stdout: string
  stderr: string
}

export class ExecError extends Error {
  readonly cmd: string
  readonly code: number
  readonly stderrTail: string
  constructor(cmd: string, code: number, stderrTail: string) {
    super(`${cmd} exited with ${code}${stderrTail ? `: ${stderrTail}` : ''}`)
    this.cmd = cmd
    this.code = code
    this.stderrTail = stderrTail
  }
}

const LINE_BREAK = /\r?\n/

/** Calls `onLine` once per complete line of a stream. */
function lineSplitter(onLine: ((line: string) => void) | undefined): (chunk: string) => void {
  let pending = ''
  return (chunk) => {
    if (!onLine) return
    const parts = (pending + chunk).split(LINE_BREAK)
    pending = parts.pop() ?? ''
    for (const line of parts) onLine(line)
  }
}

/** Spawns `cmd` with array args (never a shell) and collects its output. */
export function run(cmd: string, args: readonly string[], opts: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, [...args], { cwd: opts.cwd, env: opts.env ?? process.env, shell: false })
    let stdout = ''
    let stderr = ''
    const feed = lineSplitter(opts.onLine)
    child.stdout.setEncoding(UTF8)
    child.stderr.setEncoding(UTF8)
    child.stdout.on(STREAM_EVENT.data, (c: string) => {
      stdout += c
      feed(c)
    })
    child.stderr.on(STREAM_EVENT.data, (c: string) => {
      stderr += c
      feed(c)
    })
    const timer = opts.timeoutMs ? setTimeout(() => child.kill('SIGKILL'), opts.timeoutMs) : undefined
    const label = [cmd, ...args].join(' ')
    child.on(STREAM_EVENT.error, (e) => {
      clearTimeout(timer)
      if (opts.allowFail) resolve({ code: -1, stdout, stderr: stderr + e.message })
      else reject(new ExecError(label, -1, e.message))
    })
    child.on(STREAM_EVENT.close, (code) => {
      clearTimeout(timer)
      const exit = code ?? -1
      if (exit !== 0 && !opts.allowFail) reject(new ExecError(label, exit, stderr.slice(-STDERR_TAIL_CHARS).trim()))
      else resolve({ code: exit, stdout, stderr })
    })
  })
}
