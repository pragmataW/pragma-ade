import { randomUUID } from 'node:crypto'
import {
  type ChatService,
  type ChatStartGuard,
  type ChatStartGuardInput,
  type ChatStartGuardResult,
  COMPOSER_ENTRY_KIND,
  type ComposerEntry,
} from '../contract'
import type { ChatSessionRegistry } from './registry'

const ALLOWED: ChatStartGuardResult = { ok: true }

/** Registered start guards (11c); the first refusal wins. */
export class StartGuards {
  readonly #guards = new Set<ChatStartGuard>()

  register(guard: ChatStartGuard): () => void {
    this.#guards.add(guard)
    return () => this.#guards.delete(guard)
  }

  check(s: ChatStartGuardInput): ChatStartGuardResult {
    for (const guard of this.#guards) {
      const r = guard(s)
      if (!r.ok) return r
    }
    return ALLOWED
  }
}

/** Per-session composer additions kept in main until the composer takes them (survives unmounts and reloads). */
export class ComposerInbox {
  readonly #entries = new Map<string, ComposerEntry[]>()

  push(sessionId: string, entry: ComposerEntry): void {
    this.#entries.set(sessionId, [...(this.#entries.get(sessionId) ?? []), entry])
  }

  take(sessionId: string): ComposerEntry[] {
    const taken = this.#entries.get(sessionId) ?? []
    this.#entries.delete(sessionId)
    return taken
  }
}

function entryOf(text: string, chipLabels: string[] | undefined): ComposerEntry {
  const id = randomUUID()
  return chipLabels && chipLabels.length > 0
    ? { kind: COMPOSER_ENTRY_KIND.chip, id, text, labels: chipLabels }
    : { kind: COMPOSER_ENTRY_KIND.text, id, text }
}

export function createChatService(deps: {
  registry: Pick<ChatSessionRegistry, 'snapshot'>
  inbox: ComposerInbox
  guards: StartGuards
  publishInboxChanged(sessionId: string): void
}): ChatService {
  return {
    appendToComposer(sessionId, text, opts) {
      deps.inbox.push(sessionId, entryOf(text, opts?.chipLabels))
      deps.publishInboxChanged(sessionId)
    },
    getHistory: async (sessionId) => (await deps.registry.snapshot(sessionId)).transcript,
    registerStartGuard: (guard) => deps.guards.register(guard),
  }
}
