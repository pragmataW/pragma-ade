/** A scriptable `ChatCapability` for core and UI tests (test code only). */
import type { AgentProfile } from '@pragma/module-agents/contract'
import {
  ACTION_METHOD,
  type ChatAttachmentKind,
  type ChatCapability,
  type ChatEvent,
  type ChatMcpServer,
  type ChatOptionDescriptor,
  type ChatOptionValue,
  type ChatPermissionDecision,
  type ChatSessionActionKind,
  type ChatSessionContext,
  type ChatSessionHandle,
  type ChatStartupError,
  type ChatSupport,
  type ChatUserInput,
  validateOptionValue,
  withCurrent,
} from '../src/contract'

export class FakeChatSession implements ChatSessionHandle {
  readonly externalSessionId: string
  readonly createdWith: ChatSessionContext
  readonly sent: ChatUserInput[] = []
  interrupts = 0
  readonly permissionResponses: { requestId: string; decision: ChatPermissionDecision }[] = []
  readonly responses: { eventId: string; payload: unknown }[] = []
  readonly optionSets: { key: string; value: ChatOptionValue }[] = []
  closed = false
  killed = false
  respond?: (eventId: string, payload: unknown) => Promise<void>
  /** Calls of the optional action methods (`[method, ...args]`). */
  readonly actionCalls: unknown[][] = []
  /** What `listMcp` returns. */
  mcpServers: ChatMcpServer[] = []
  #options: ChatOptionDescriptor[]

  constructor(
    ctx: ChatSessionContext,
    opts: { options: ChatOptionDescriptor[]; interactive: boolean; n: number; actions: ChatSessionActionKind[] },
  ) {
    this.createdWith = ctx
    this.externalSessionId = ctx.resumeExternalSessionId ?? `fake-ext-${opts.n}`
    this.#options = opts.options
    if (opts.interactive)
      this.respond = async (eventId, payload) => {
        this.responses.push({ eventId, payload })
      }
    const self = this as unknown as Record<string, unknown>
    for (const action of opts.actions) {
      const method = ACTION_METHOD[action]
      self[method] = async (...args: unknown[]) => {
        this.actionCalls.push([method, ...args])
        return method === ACTION_METHOD.refreshMcp ? this.mcpServers : undefined
      }
    }
  }

  emit(e: ChatEvent): void {
    this.createdWith.emit(e)
  }

  finishTurn(reason: Extract<ChatEvent, { kind: 'turn-end' }>['reason'] = 'completed'): void {
    this.emit({ kind: 'turn-end', reason })
  }

  describeOptions(): ChatOptionDescriptor[] {
    return this.#options
  }

  async setOption(key: string, value: ChatOptionValue): Promise<void> {
    const d = this.#options.find((o) => o.key === key)
    if (!d || !validateOptionValue(d, value)) throw new Error(`invalid option ${key}`)
    this.optionSets.push({ key, value })
    this.#options = withCurrent(this.#options, key, value)
    this.emit({ kind: 'options', options: this.#options })
  }

  async send(input: ChatUserInput): Promise<void> {
    this.sent.push(input)
  }

  async interrupt(): Promise<void> {
    this.interrupts++
  }

  async respondPermission(requestId: string, decision: ChatPermissionDecision): Promise<void> {
    this.permissionResponses.push({ requestId, decision })
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    this.emit({ kind: 'session-exit', exitCode: 0, reason: 'closed' })
  }

  kill(): void {
    this.killed = true
    void this.close()
  }
}

export interface FakeChatCapabilityOptions {
  support?: ChatSupport
  startupError?: ChatStartupError
  history?: ChatEvent[]
  options?: ChatOptionDescriptor[]
  /** `respond` is defined (interactive custom events). */
  interactive?: boolean
  /** Optional action methods the sessions implement. */
  actions?: ChatSessionActionKind[]
  attachmentKinds?: ChatAttachmentKind[]
  midTurnInput?: boolean
}

export function createFakeChatCapability(opts: FakeChatCapabilityOptions = {}) {
  const sessions: FakeChatSession[] = []
  const supportChecks: AgentProfile[] = []
  const historyRequests: string[] = []
  const capability: ChatCapability = {
    ...(opts.attachmentKinds ? { attachmentKinds: opts.attachmentKinds } : {}),
    ...(opts.midTurnInput ? { midTurnInput: true } : {}),
    async checkSupport(profile) {
      supportChecks.push(profile)
      return opts.support ?? { ok: true }
    },
    async createSession(ctx) {
      if (opts.startupError) throw opts.startupError
      const options = opts.options ?? []
      const session = new FakeChatSession(ctx, {
        options,
        interactive: opts.interactive ?? false,
        n: sessions.length + 1,
        actions: opts.actions ?? [],
      })
      sessions.push(session)
      ctx.emit({ kind: 'session-info', externalSessionId: session.externalSessionId, commands: [] })
      ctx.emit({ kind: 'options', options })
      return session
    },
    async loadHistory(ctx) {
      historyRequests.push(ctx.externalSessionId)
      return opts.history ?? []
    },
  }
  return {
    capability,
    sessions,
    supportChecks,
    historyRequests,
    lastSession(): FakeChatSession {
      const s = sessions.at(-1)
      if (!s) throw new Error('no fake chat session yet')
      return s
    },
  }
}
