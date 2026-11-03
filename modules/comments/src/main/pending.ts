import { randomUUID } from 'node:crypto'
import type { AgentSessionStartedPayload } from '@pragma/module-agents/contract'
import { PENDING_TTL_MS, PTY_ID_POLL_MAX_MS, PTY_ID_POLL_MS, READY_QUIET_MS, READY_TIMEOUT_MS } from '../constants'
import type { CommentsService, SendResult } from '../contract'
import { pollUntil } from './lib/wait'
import type { CommentsUpstream } from './upstream'

export interface PendingOptions {
  readyQuietMs?: number
  readyTimeoutMs?: number
  ttlMs?: number
}

interface Entry {
  id: string
  createdAt: number
  claimed: boolean
}

const DEFAULTS: Required<PendingOptions> = {
  readyQuietMs: READY_QUIET_MS,
  readyTimeoutMs: READY_TIMEOUT_MS,
  ttlMs: PENDING_TTL_MS,
}

/**
 * "Start an agent, then deliver the review round": one entry per worktree (whatever is pending at delivery time), delivered to the next session started in THAT worktree once
 * its pty produced output and went quiet (so the agent had time to enable bracketed paste), or after a timeout.
 */
export class PendingDeliveries {
  readonly #entries = new Map<string, Entry>()
  readonly #upstream: CommentsUpstream
  readonly #send: CommentsService['send']
  readonly #onDelivered: (worktreeId: string, r: SendResult) => void
  readonly #off: () => void
  #opts: Required<PendingOptions>

  constructor(
    upstream: CommentsUpstream,
    send: CommentsService['send'],
    onDelivered: (worktreeId: string, r: SendResult) => void,
    opts: PendingOptions = {},
  ) {
    this.#upstream = upstream
    this.#send = send
    this.#onDelivered = onDelivered
    this.#opts = { ...DEFAULTS, ...opts }
    this.#off = upstream.onSessionStarted((e) => void this.#onStarted(e))
  }

  /** A new entry replaces the worktree's old one. */
  add(worktreeId: string): string {
    const id = randomUUID()
    this.#entries.set(worktreeId, { id, createdAt: Date.now(), claimed: false })
    return id
  }

  cancel(worktreeId: string): void {
    this.#entries.delete(worktreeId)
  }

  setOptions(opts: PendingOptions): void {
    this.#opts = { ...this.#opts, ...opts }
  }

  dispose(): void {
    this.#off()
    this.#entries.clear()
  }

  async #onStarted(e: AgentSessionStartedPayload): Promise<void> {
    const entry = this.#entries.get(e.worktreeId)
    if (!entry || entry.claimed) return
    if (Date.now() - entry.createdAt > this.#opts.ttlMs) {
      this.#entries.delete(e.worktreeId)
      return
    }
    entry.claimed = true
    const ptyId = e.ptyId ?? (await this.#pollPtyId(e.sessionId))
    if (ptyId) await this.#waitReady(ptyId)
    if (this.#entries.get(e.worktreeId) !== entry) return
    this.#entries.delete(e.worktreeId)
    const result = await this.#send(e.worktreeId, e.sessionId, { promptUser: false })
    this.#onDelivered(e.worktreeId, result)
  }

  #pollPtyId(sessionId: string): Promise<string | null> {
    const read = async () => (await this.#upstream.getSession(sessionId))?.ptyId ?? null
    return pollUntil(read, PTY_ID_POLL_MAX_MS, PTY_ID_POLL_MS)
  }

  /** Output, then `readyQuietMs` of silence; or `readyTimeoutMs` in all. */
  #waitReady(ptyId: string): Promise<void> {
    const { readyQuietMs, readyTimeoutMs } = this.#opts
    return new Promise((resolve) => {
      let quiet: ReturnType<typeof setTimeout> | undefined
      const off = this.#upstream.onPtyData(ptyId, () => {
        clearTimeout(quiet)
        quiet = setTimeout(finish, readyQuietMs)
      })
      const timeout = setTimeout(finish, readyTimeoutMs)
      function finish() {
        clearTimeout(quiet)
        clearTimeout(timeout)
        off()
        resolve()
      }
    })
  }
}
