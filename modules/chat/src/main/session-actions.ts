import {
  SESSION_ACTION as A,
  ACTION_METHOD,
  ACTION_UNSUPPORTED_KEY,
  ATTACHMENT_KIND,
  type ChatAttachmentKind,
  type ChatAttachmentRef,
  type ChatEvent,
  type ChatSessionAction,
  type ChatSessionHandle,
  type ChatUserInput,
  documentKindOf,
  EVENT_KIND as K,
} from '../contract'

export class ActionUnsupportedError extends Error {}

/** Runs an optional session action on the live handle; `refreshMcp` emits the servers as `mcp-status`. */
export async function runSessionAction(
  handle: ChatSessionHandle | null,
  a: ChatSessionAction,
  emit: (e: ChatEvent) => void,
): Promise<void> {
  if (!handle || typeof handle[ACTION_METHOD[a.action]] !== 'function')
    throw new ActionUnsupportedError(ACTION_UNSUPPORTED_KEY)
  switch (a.action) {
    case A.toggleMcp:
      return handle.toggleMcp?.(a.name, a.enabled)
    case A.reconnectMcp:
      return handle.reconnectMcp?.(a.name)
    case A.refreshMcp: {
      const servers = await handle.listMcp?.()
      if (servers) emit({ kind: K.mcpStatus, servers })
      return
    }
    case A.rewind:
      return handle.rewind?.(a.messageId)
    case A.stopTask:
      return handle.stopTask?.(a.taskId)
    case A.fork:
      return handle.fork?.(a.messageId)
    default: {
      const never: never = a
      return never
    }
  }
}

const DEFAULT_KINDS: readonly ChatAttachmentKind[] = [ATTACHMENT_KIND.image]

/** The input without documents the provider does not accept (`ChatCapability.attachmentKinds`). */
export function acceptedInput(input: ChatUserInput, kinds: readonly ChatAttachmentKind[] = DEFAULT_KINDS) {
  if (!input.files) return input
  const files = input.files.filter((f) => kinds.includes(documentKindOf(f.mediaType)))
  return { ...input, files }
}

/** The attachment refs of a user message (images, then documents). */
export const attachmentRefs = (input: ChatUserInput): ChatAttachmentRef[] => [
  ...input.images.map((i) => ({ kind: ATTACHMENT_KIND.image, name: i.name, mediaType: i.mediaType })),
  ...(input.files ?? []).map((f) => ({ kind: documentKindOf(f.mediaType), name: f.name, mediaType: f.mediaType })),
]
