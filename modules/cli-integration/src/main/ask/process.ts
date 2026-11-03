import { type ChildProcess, spawn } from 'node:child_process'
import { ASK_KILL_GRACE_MS, ASK_MAX_STDERR_BYTES, ASK_MAX_STDOUT_BYTES, TASKKILL, WIN32 } from '../../constants'
import { type AskOutput, type AskSpec, askSpecSchema } from '../../contract'

export interface RunAskOptions {
  cwd: string
  timeoutMs: number
  signal?: AbortSignal
  maxStdoutBytes?: number
  maxStderrBytes?: number
  killGraceMs?: number
}

/** How a run ended (named access, one source). */
export const ASK_OUTCOME = {
  exited: 'exited',
  timedOut: 'timedOut',
  aborted: 'aborted',
  tooLarge: 'tooLarge',
  spawnFailed: 'spawnFailed',
} as const
const O = ASK_OUTCOME

export type RunAskOutcome =
  | ({ kind: typeof O.exited } & AskOutput)
  | { kind: typeof O.timedOut }
  | { kind: typeof O.aborted }
  | { kind: typeof O.tooLarge }
  | { kind: typeof O.spawnFailed; message: string }

type StopKind = typeof O.timedOut | typeof O.aborted | typeof O.tooLarge
const SIGTERM = 'SIGTERM'
const SIGKILL = 'SIGKILL'
const PIPE = 'pipe'
const ABORT_EVENT = 'abort'
const EVENT = { data: 'data', exit: 'exit', close: 'close', error: 'error' } as const

/** Signals the child's process group (POSIX, spawned `detached`) or its tree (Windows `taskkill /T`). */
function killTree(child: ChildProcess, signal: NodeJS.Signals): void {
  const pid = child.pid
  if (pid === undefined) return
  try {
    if (process.platform === WIN32) spawn(TASKKILL.exe, [...TASKKILL.args, String(pid)], { windowsHide: true })
    else process.kill(-pid, signal)
  } catch {
    // the group is already gone
  }
}

/** stdout up to `maxOut` bytes (`onOverflow` past it), the last `maxErr` bytes of stderr. */
function collect(child: ChildProcess, maxOut: number, maxErr: number, onOverflow: () => void) {
  const out: Buffer[] = []
  let outBytes = 0
  let err = Buffer.alloc(0)
  child.stdout?.on(EVENT.data, (d: Buffer) => {
    outBytes += d.length
    if (outBytes > maxOut) return onOverflow()
    out.push(d)
  })
  child.stderr?.on(EVENT.data, (d: Buffer) => {
    const all = Buffer.concat([err, d])
    err = all.length > maxErr ? all.subarray(all.length - maxErr) : all
  })
  return { stdout: () => Buffer.concat(out).toString(), stderr: () => err.toString() }
}

/** The timeout and abort triggers; returns the cleanup. */
function armTimers(o: RunAskOptions, stop: (kind: StopKind) => void): () => void {
  const timer = setTimeout(() => stop(O.timedOut), o.timeoutMs)
  const onAbort = () => stop(O.aborted)
  o.signal?.addEventListener(ABORT_EVENT, onAbort, { once: true })
  return () => {
    clearTimeout(timer)
    o.signal?.removeEventListener(ABORT_EVENT, onAbort)
  }
}

function startChild(spec: AskSpec, cwd: string): ChildProcess {
  const child = spawn(spec.command, spec.args, {
    cwd,
    env: spec.env,
    shell: false,
    windowsHide: true,
    detached: process.platform !== WIN32,
    stdio: PIPE,
  })
  // a write after the child exits must not crash main
  child.stdin?.on(EVENT.error, () => undefined)
  child.stdin?.end(spec.stdin ?? undefined)
  return child
}

/**
 * Runs one headless question: stdin written and closed, output capped, the tree killed on timeout, abort or
 * overflow (SIGTERM, then SIGKILL after the grace). Resolves once the child's streams closed.
 */
export async function runAskProcess(spec: AskSpec, o: RunAskOptions): Promise<RunAskOutcome> {
  const valid = askSpecSchema.parse(spec)
  if (o.signal?.aborted) return { kind: O.aborted }
  return new Promise((resolve) => {
    const child = startChild(valid, o.cwd)
    let stopped: StopKind | null = null
    let killTimer: ReturnType<typeof setTimeout> | undefined
    const stop = (kind: StopKind) => {
      if (stopped) return
      stopped = kind
      killTree(child, SIGTERM)
      killTimer = setTimeout(() => killTree(child, SIGKILL), o.killGraceMs ?? ASK_KILL_GRACE_MS)
    }
    const io = collect(child, o.maxStdoutBytes ?? ASK_MAX_STDOUT_BYTES, o.maxStderrBytes ?? ASK_MAX_STDERR_BYTES, () =>
      stop(O.tooLarge),
    )
    const disarm = armTimers(o, stop)
    const finish = (outcome: RunAskOutcome) => {
      disarm()
      clearTimeout(killTimer)
      resolve(outcome)
    }
    // leftovers in the group (helpers that keep our pipes open) go with the leader
    child.once(EVENT.exit, () => killTree(child, SIGTERM))
    child.once(EVENT.error, (e) => {
      if (child.pid === undefined) finish({ kind: O.spawnFailed, message: e.message })
    })
    child.once(EVENT.close, (code: number | null) =>
      finish(
        stopped ? { kind: stopped } : { kind: O.exited, exitCode: code, stdout: io.stdout(), stderr: io.stderr() },
      ),
    )
  })
}
