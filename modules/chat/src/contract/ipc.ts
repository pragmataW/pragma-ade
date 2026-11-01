import { agentSessionStatuses } from '@pragma/module-agents/contract'
import { defineIpc, defineIpcEvent, z } from '@pragma/sdk'
import { chatImageSchema } from './capability'
import { CHAT_IPC as C, CHAT_IPC_EVENTS as E, FILE_SEARCH_LIMIT } from './constants'
import { chatEventEnvelopeSchema, chatPermissionOptionSchema } from './events'
import { chatOptionValueSchema } from './options'
import type { ChatTranscript } from './transcript'

const none = z.void()
const session = { sessionId: z.string().min(1) }
const sessionRef = z.object(session)

/** Built from schema-validated events by the reducer; passed through as is. */
export const chatTranscriptSchema = z.custom<ChatTranscript>((v) => typeof v === 'object' && v !== null)
export const chatSnapshotSchema = z.object({
  providerId: z.string(),
  transcript: chatTranscriptSchema,
  status: z.enum(agentSessionStatuses),
})
export type ChatSnapshotDto = z.infer<typeof chatSnapshotSchema>

export const chatSupportSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), reasonKey: z.string(), detail: z.string().optional() }),
])

/** Renderer → main requests (`chat.*`). */
export const chatIpc = {
  open: defineIpc({ channel: C.open, input: sessionRef, output: chatSnapshotSchema }),
  send: defineIpc({
    channel: C.send,
    input: z.object({ ...session, text: z.string(), images: z.array(chatImageSchema) }),
    output: z.object({ queued: z.boolean() }),
  }),
  cancelQueued: defineIpc({
    channel: C.cancelQueued,
    input: z.object({ ...session, queuedId: z.string() }),
    output: none,
  }),
  interrupt: defineIpc({ channel: C.interrupt, input: sessionRef, output: none }),
  respondPermission: defineIpc({
    channel: C.respondPermission,
    input: z.object({ ...session, requestId: z.string(), decision: chatPermissionOptionSchema }),
    output: none,
  }),
  respond: defineIpc({
    channel: C.respond,
    input: z.object({ ...session, eventId: z.string(), payload: z.unknown() }),
    output: none,
  }),
  setOption: defineIpc({
    channel: C.setOption,
    input: z.object({ ...session, key: z.string().min(1), value: chatOptionValueSchema }),
    output: none,
  }),
  searchFiles: defineIpc({
    channel: C.searchFiles,
    input: z.object({ ...session, query: z.string(), limit: z.number().int().positive().default(FILE_SEARCH_LIMIT) }),
    output: z.array(z.string()),
  }),
  checkSupport: defineIpc({
    channel: C.checkSupport,
    input: z.object({ profileId: z.string() }),
    output: chatSupportSchema,
  }),
} as const

/** PRAGMA_TEST only: the live snapshot without dormant loading (null when not loaded). */
export const chatTestIpc = {
  snapshot: defineIpc({ channel: C.testSnapshot, input: sessionRef, output: chatSnapshotSchema.nullable() }),
} as const

export const composerAppendSchema = z.object({ ...session, text: z.string() })
export type ComposerAppend = z.infer<typeof composerAppendSchema>

/** Main → renderer events. */
export const chatIpcEvents = {
  event: defineIpcEvent({ channel: E.event, payload: chatEventEnvelopeSchema }),
  composerAppend: defineIpcEvent({ channel: E.composerAppend, payload: composerAppendSchema }),
} as const
