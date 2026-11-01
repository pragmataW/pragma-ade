import { randomUUID } from 'node:crypto'
import { accessSync, constants, statSync } from 'node:fs'
import { EXIT_OK, SHUTDOWN_GRACE_MS, UNKNOWN_REQUEST_ID } from './constants'
import {
  DAEMON_ERROR,
  type DaemonError,
  type DaemonErrorCode,
  type DaemonRequest,
  DaemonRequestSchema,
  HANGUP_SIGNAL,
  MSG,
  PROTOCOL_VERSION,
  REQ,
  type SpawnSpec,
} from './protocol'
import { type PtyFactory, PtySession } from './session'
import type { Transport } from './transport'

class RequestError extends Error {
  readonly code: DaemonErrorCode
  constructor(code: DaemonErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

const PATH_SEPARATOR_RE = /[\\/]/
const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/** Path-like commands are checked up front: node-pty reports a failed exec only as `exit 1`. */
function assertSpawnable(spec: SpawnSpec): void {
  if (!isDirectory(spec.cwd)) throw new RequestError(DAEMON_ERROR.cwdNotFound, `cwd not found: ${spec.cwd}`)
  if (!PATH_SEPARATOR_RE.test(spec.command)) return
  try {
    accessSync(spec.command, constants.X_OK)
  } catch (error) {
    throw new RequestError(DAEMON_ERROR.spawnFailed, `cannot execute ${spec.command}: ${messageOf(error)}`)
  }
}

const requestIdOf = (raw: unknown): number => {
  const id = (raw as { id?: unknown } | null)?.id
  return typeof id === 'number' && Number.isInteger(id) ? id : UNKNOWN_REQUEST_ID
}

/** Request dispatcher of the pty-daemon process: owns every `PtySession`. */
export class PtyDaemon {
  readonly #transport: Transport
  readonly #factory: PtyFactory | undefined
  readonly #exit: (code: number) => void
  readonly #idGen: () => string
  readonly #sessions = new Map<string, PtySession>()
  #shuttingDown: Promise<void> | undefined

  constructor(
    transport: Transport,
    opts: { factory?: PtyFactory; exit?: (code: number) => void; idGen?: () => string } = {},
  ) {
    this.#transport = transport
    this.#factory = opts.factory
    this.#exit = opts.exit ?? ((code) => process.exit(code))
    this.#idGen = opts.idGen ?? randomUUID
  }

  start(): void {
    this.#transport.onMessage((raw) => void this.#handle(raw))
    this.#transport.onClose(() => void this.shutdown())
    this.#transport.send({ kind: MSG.ready, pid: process.pid, protocolVersion: PROTOCOL_VERSION })
  }

  /** Hangs up every pty, SIGKILLs the rest after the grace period, then exits. Idempotent. */
  shutdown(): Promise<void> {
    this.#shuttingDown ??= this.#stopAll().then(() => this.#exit(EXIT_OK))
    return this.#shuttingDown
  }

  async #stopAll(): Promise<void> {
    const sessions = [...this.#sessions.values()]
    const grace = new Promise<void>((resolve) => setTimeout(resolve, SHUTDOWN_GRACE_MS).unref())
    await Promise.race([Promise.all(sessions.map((s) => s.kill(HANGUP_SIGNAL))), grace])
    for (const s of sessions) s.dispose()
    this.#sessions.clear()
  }

  async #handle(raw: unknown): Promise<void> {
    const parsed = DaemonRequestSchema.safeParse(raw)
    if (!parsed.success) {
      this.#fail(requestIdOf(raw), { code: DAEMON_ERROR.badRequest, message: parsed.error.message })
      return
    }
    const req = parsed.data
    try {
      const result = await this.#dispatch(req)
      this.#transport.send({ kind: MSG.response, id: req.id, ok: true, result })
      if (req.type === REQ.shutdown) await this.shutdown()
    } catch (error) {
      const code = error instanceof RequestError ? error.code : DAEMON_ERROR.internal
      this.#fail(req.id, { code, message: messageOf(error) })
    }
  }

  #fail(id: number, error: DaemonError): void {
    this.#transport.send({ kind: MSG.response, id, ok: false, error })
  }

  #session(ptyId: string): PtySession {
    const session = this.#sessions.get(ptyId)
    if (!session) throw new RequestError(DAEMON_ERROR.notFound, `unknown pty ${ptyId}`)
    return session
  }

  #spawn(spec: SpawnSpec) {
    assertSpawnable(spec)
    const id = this.#idGen()
    let session: PtySession
    try {
      session = new PtySession(id, spec, (e) => this.#transport.send(e), this.#factory)
    } catch (error) {
      throw new RequestError(DAEMON_ERROR.spawnFailed, messageOf(error))
    }
    this.#sessions.set(id, session)
    return session.info
  }

  async #kill(ptyId: string, signal: Parameters<PtySession['kill']>[0]) {
    const session = this.#session(ptyId)
    const info = await session.kill(signal)
    session.dispose()
    this.#sessions.delete(ptyId)
    return info
  }

  #dispatch(req: DaemonRequest): unknown {
    switch (req.type) {
      case REQ.spawn:
        return this.#spawn(req.spec)
      case REQ.write:
        return this.#session(req.ptyId).write(req.data)
      case REQ.paste:
        return this.#session(req.ptyId).paste(req.text)
      case REQ.resize:
        return this.#session(req.ptyId).resize(req.cols, req.rows)
      case REQ.kill:
        return this.#kill(req.ptyId, req.signal)
      case REQ.snapshot:
        return this.#session(req.ptyId).snapshot()
      case REQ.readText:
        return this.#session(req.ptyId).readText()
      case REQ.list:
        return [...this.#sessions.values()].map((s) => s.info)
      case REQ.shutdown:
        return null
      default: {
        const never: never = req
        throw new RequestError(DAEMON_ERROR.badRequest, `unhandled request ${JSON.stringify(never)}`)
      }
    }
  }
}
