import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { ChatStartupError } from '@pragma/module-chat/contract'
import type { Logger } from '@pragma/sdk'
import {
  AUTHORIZATION_HEADER,
  ENOENT,
  START_FAILURE as F,
  HEALTH_PATH,
  HTTP_NOT_FOUND,
  INFO_PATH,
  INFO_TIMEOUT_MS,
  LEGACY_VERSION_LABEL,
  MIN_MAJOR,
  NEWLINE,
  OUTPUT_TAIL_BYTES,
  PIPE_STDIO,
  READY_FORMAT,
  REASON,
  SIGNALS,
  STOP_GRACE_MS,
  STREAM_EVENT,
  TASKKILL,
  TASKKILL_ARGS,
  WIN32,
} from '../constants'
import { healthSchema, serverInfoSchema } from '../schemas'
import { parseReadyLine, parseVersion } from './ready'
import { basicAuthHeader, type ServeSpec } from './spawn-spec'

export interface ServerHandle {
  readonly url: string
  readonly version: string
  readonly pid: number
  readonly authHeader: string
  readonly exited: boolean
  readonly exitCode: number | null
  /** The last `OUTPUT_TAIL_BYTES` of stdout + stderr. */
  outputTail(): string
  onExit(cb: (code: number | null) => void): () => void
  /** Idempotent: end stdin (lease) → SIGTERM the group → SIGKILL. */
  stop(): Promise<void>
  /** Synchronous last resort (app exit): end stdin and SIGKILL the group. */
  killNow(): void
}

export interface StartOptions {
  startTimeoutMs: number
  log: Pick<Logger, 'info' | 'warn'>
  stopGraceMs?: number
}

/** Why a `serve` start failed; `classifyStartFailure` maps it to a startup error. */
export type StartFailure =
  | { kind: 'legacy'; healthVersion?: string }
  | { kind: 'old'; version: string }
  | { kind: 'info-error'; message: string }
  | { kind: 'spawn-error'; code?: string; command: string; message: string }
  | { kind: 'exited'; code: number | null; stderrLine: string }
  | { kind: 'timeout'; tail: string }

/** One pure table from failure to `ChatStartupError` (reason key + detail). */
export function classifyStartFailure(f: StartFailure): ChatStartupError {
  switch (f.kind) {
    case F.legacy:
      return new ChatStartupError(REASON.upgradeRequired, f.healthVersion ?? LEGACY_VERSION_LABEL)
    case F.old:
      return new ChatStartupError(REASON.upgradeRequired, f.version)
    case F.infoError:
      return new ChatStartupError(REASON.infoFailed, f.message)
    case F.spawnError:
      return f.code === ENOENT
        ? new ChatStartupError(REASON.commandNotFound, f.command)
        : new ChatStartupError(REASON.exitedEarly, f.message)
    case F.exited:
      return new ChatStartupError(REASON.exitedEarly, `exit ${f.code}: ${f.stderrLine}`)
    case F.timeout:
      return new ChatStartupError(REASON.noProtocol, f.tail)
    default: {
      const never: never = f
      return never
    }
  }
}

class StartFailed extends Error {
  readonly failure: StartFailure
  constructor(failure: StartFailure) {
    super(failure.kind)
    this.failure = failure
  }
}

const lastLine = (text: string): string => text.trim().split(NEWLINE).at(-1) ?? ''
const tailOf = (text: string): string => text.slice(-OUTPUT_TAIL_BYTES)

async function getJson(url: string, authHeader: string): Promise<Response> {
  return fetch(url, { headers: { [AUTHORIZATION_HEADER]: authHeader }, signal: AbortSignal.timeout(INFO_TIMEOUT_MS) })
}

async function healthVersion(url: string, authHeader: string): Promise<string | undefined> {
  try {
    const res = await getJson(url + HEALTH_PATH, authHeader)
    return healthSchema.parse(await res.json()).version
  } catch {
    return undefined
  }
}

/** `/api/info` → the version; 404/non-JSON means a 1.x server, a major below 2 is too old. */
async function probeVersion(url: string, authHeader: string): Promise<string> {
  let res: Response
  try {
    res = await getJson(url + INFO_PATH, authHeader)
  } catch (e) {
    throw new StartFailed({ kind: F.infoError, message: String(e) })
  }
  const body = res.ok ? serverInfoSchema.safeParse(await res.json().catch(() => null)) : null
  if (res.status === HTTP_NOT_FOUND || (body && !body.success))
    throw new StartFailed({ kind: F.legacy, healthVersion: await healthVersion(url, authHeader) })
  if (!body?.success) throw new StartFailed({ kind: F.infoError, message: `HTTP ${res.status}` })
  const version = body.data.version
  const parsed = parseVersion(version)
  if (parsed && parsed.major < MIN_MAJOR) throw new StartFailed({ kind: F.old, version })
  return version
}

/** Spawns `opencode serve --stdio`, waits for the ready line and checks `/api/info` (OpenCode ≥ 2 only). */
export async function startServer(spec: ServeSpec, o: StartOptions): Promise<ServerHandle> {
  const child = spawn(spec.command, spec.args, {
    cwd: spec.cwd,
    env: spec.env,
    stdio: [...PIPE_STDIO],
    detached: process.platform !== WIN32,
  })
  const proc = trackChild(child, o.stopGraceMs ?? STOP_GRACE_MS)
  try {
    const ready = await proc.ready(o.startTimeoutMs)
    const authHeader = basicAuthHeader(spec.password)
    if (ready.format === READY_FORMAT.legacy)
      throw new StartFailed({ kind: F.legacy, healthVersion: await healthVersion(ready.url, authHeader) })
    const version = await probeVersion(ready.url, authHeader)
    o.log.info(`opencode serve ${version} ready at ${ready.url} (pid ${child.pid})`)
    return proc.handle(ready.url, version, authHeader)
  } catch (e) {
    await proc.stop()
    throw e instanceof StartFailed ? classifyStartFailure(e.failure) : e
  }
}

type Ready = NonNullable<ReturnType<typeof parseReadyLine>>

/** Child bookkeeping: output tails, exit listeners, the ready race and the stop ladder. */
function trackChild(child: ChildProcessWithoutNullStreams, graceMs: number) {
  let output = ''
  let stderr = ''
  let exitCode: number | null = null
  let exited = false
  let spawnError: NodeJS.ErrnoException | null = null
  const exitCbs = new Set<(code: number | null) => void>()
  child.stdout.on(STREAM_EVENT.data, (d: Buffer) => {
    output = tailOf(output + d.toString())
  })
  child.stderr.on(STREAM_EVENT.data, (d: Buffer) => {
    output = tailOf(output + d.toString())
    stderr = tailOf(stderr + d.toString())
  })
  const exitedP = new Promise<void>((resolve) => {
    child.once(STREAM_EVENT.close, (code) => {
      exited = true
      exitCode = code
      for (const cb of exitCbs) cb(code)
      resolve()
    })
    child.once(STREAM_EVENT.error, (e: NodeJS.ErrnoException) => {
      spawnError = e
      if (child.pid === undefined) {
        exited = true
        resolve()
      }
    })
  })
  // a stdin write after the child exits must not crash main
  child.stdin.on(STREAM_EVENT.error, () => undefined)

  const signalGroup = (signal: NodeJS.Signals) => {
    if (exited || child.pid === undefined) return
    try {
      if (process.platform === WIN32) spawn(TASKKILL, [...TASKKILL_ARGS, String(child.pid)])
      else process.kill(-child.pid, signal)
    } catch {
      child.kill(signal)
    }
  }
  const waitExit = (ms: number) =>
    Promise.race([exitedP.then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), ms).unref())])
  let stopping: Promise<void> | null = null
  const stop = (): Promise<void> => {
    stopping ??= (async () => {
      if (exited) return
      child.stdin.end()
      if (await waitExit(graceMs)) return
      signalGroup(SIGNALS.term)
      if (await waitExit(graceMs)) return
      signalGroup(SIGNALS.kill)
      await exitedP
    })()
    return stopping
  }

  const ready = (timeoutMs: number) =>
    new Promise<Ready>((resolve, reject) => {
      const timer = setTimeout(() => reject(new StartFailed({ kind: F.timeout, tail: output.trim() })), timeoutMs)
      const settle = (fn: () => void) => {
        clearTimeout(timer)
        child.stdout.off(STREAM_EVENT.data, onData)
        fn()
      }
      const onData = () => {
        const r = parseReadyLine(output)
        if (r) settle(() => resolve(r))
      }
      child.stdout.on(STREAM_EVENT.data, onData)
      exitedP.then(() =>
        settle(() =>
          reject(
            new StartFailed(
              spawnError && child.pid === undefined
                ? {
                    kind: F.spawnError,
                    code: spawnError.code,
                    command: String(child.spawnfile),
                    message: spawnError.message,
                  }
                : { kind: F.exited, code: exitCode, stderrLine: lastLine(stderr) },
            ),
          ),
        ),
      )
    })

  const handle = (url: string, version: string, authHeader: string): ServerHandle => ({
    url,
    version,
    pid: child.pid ?? -1,
    authHeader,
    get exited() {
      return exited
    },
    get exitCode() {
      return exitCode
    },
    outputTail: () => output.trim(),
    onExit(cb) {
      exitCbs.add(cb)
      return () => exitCbs.delete(cb)
    },
    stop,
    killNow() {
      if (exited) return
      child.stdin.end()
      signalGroup(SIGNALS.kill)
    },
  })
  return { ready, stop, handle }
}
