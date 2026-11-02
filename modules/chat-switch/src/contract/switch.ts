import { z } from '@pragma/sdk'

/** The discriminator of every result union. */
const OK_KEY = 'ok'

export const SWITCH_TARGETS = ['terminal', 'chat'] as const
export const SWITCH_TARGET = { terminal: SWITCH_TARGETS[0], chat: SWITCH_TARGETS[1] } as const
export const switchTargetSchema = z.enum(SWITCH_TARGETS)
export type SwitchTarget = z.infer<typeof switchTargetSchema>

export const SWITCH_PHASES = ['idle', 'switching', 'done', 'failed'] as const
export const SWITCH_PHASE = {
  idle: SWITCH_PHASES[0],
  switching: SWITCH_PHASES[1],
  done: SWITCH_PHASES[2],
  failed: SWITCH_PHASES[3],
} as const
export const switchPhaseSchema = z.enum(SWITCH_PHASES)
export type SwitchPhase = z.infer<typeof switchPhaseSchema>

export const eligibilitySchema = z.discriminatedUnion(OK_KEY, [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), reasonKey: z.string() }),
])
export type Eligibility = z.infer<typeof eligibilitySchema>

export const switchEligibilitySchema = z.object({ terminal: eligibilitySchema, chat: eligibilitySchema })
export type SwitchEligibility = z.infer<typeof switchEligibilitySchema>

export const switchResultSchema = z.discriminatedUnion(OK_KEY, [
  z.object({ ok: z.literal(true), sessionId: z.string() }),
  z.object({ ok: z.literal(false), errorKey: z.string() }),
])
export type SwitchResult = z.infer<typeof switchResultSchema>
