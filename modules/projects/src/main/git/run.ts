import { type ExecFileException, execFile } from 'node:child_process'
import { GIT_MAX_BUFFER_BYTES, UTF8 } from '../../constants'
import type { GitRunResult } from '../../contract'

export interface ExecOptions {
  cwd: string
  env: Record<string, string>
  input?: string
  timeoutMs?: number
}
/** Runs a process to completion; rejects only when it cannot be spawned (error `code` is a string, e.g. ENOENT). */
export type ExecFn = (file: string, args: string[], o: ExecOptions) => Promise<GitRunResult>

export const defaultExec: ExecFn = (file, args, o) =>
  new Promise((resolve, reject) => {
    const child = execFile(
      file,
      args,
      {
        cwd: o.cwd,
        env: o.env,
        encoding: UTF8,
        maxBuffer: GIT_MAX_BUFFER_BYTES,
        windowsHide: true,
        timeout: o.timeoutMs,
      },
      (error: ExecFileException | null, stdout: string, stderr: string) => {
        if (error && typeof error.code !== 'number') {
          if (error.code === undefined) resolve({ stdout, stderr: stderr || error.message, exitCode: -1 })
          else reject(error)
          return
        }
        resolve({ stdout, stderr, exitCode: error ? (error.code as number) : 0 })
      },
    )
    if (o.input !== undefined) child.stdin?.end(o.input)
  })
