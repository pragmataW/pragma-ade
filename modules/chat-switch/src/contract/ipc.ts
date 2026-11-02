import { defineIpc, defineIpcEvent, z } from '@pragma/sdk'
import { CHAT_SWITCH_IPC as C, CHAT_SWITCH_IPC_EVENTS as E } from './constants'
import { switchEligibilitySchema, switchPhaseSchema, switchResultSchema, switchTargetSchema } from './switch'

const sessionRef = z.object({ sessionId: z.string().min(1) })

/** Renderer → main requests (`chat-switch.*`). */
export const chatSwitchIpc = {
  eligibility: defineIpc({ channel: C.eligibility, input: sessionRef, output: switchEligibilitySchema }),
  switch: defineIpc({
    channel: C.switch,
    input: sessionRef.extend({ target: switchTargetSchema }),
    output: switchResultSchema,
  }),
} as const

/** PRAGMA_TEST only. */
export const chatSwitchTestIpc = {
  guardOwner: defineIpc({
    channel: C.testGuardOwner,
    input: z.object({ providerId: z.string(), externalSessionId: z.string() }),
    output: z.object({ ownerSessionId: z.string().optional() }),
  }),
  disableRetain: defineIpc({
    channel: C.testDisableRetain,
    input: z.object({ disabled: z.boolean() }),
    output: z.void(),
  }),
} as const

export const changedEventSchema = z.object({
  sessionId: z.string(),
  phase: switchPhaseSchema,
  errorKey: z.string().optional(),
})
export type ChangedEvent = z.infer<typeof changedEventSchema>

export const conflictEventSchema = z.object({ sessionId: z.string(), ownerSessionId: z.string() })
export type ConflictEvent = z.infer<typeof conflictEventSchema>

/** Main → renderer events. */
export const chatSwitchIpcEvents = {
  changed: defineIpcEvent({ channel: E.changed, payload: changedEventSchema }),
  conflict: defineIpcEvent({ channel: E.conflict, payload: conflictEventSchema }),
} as const
