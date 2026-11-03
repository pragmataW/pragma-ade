import { z } from '@pragma/sdk'

/** The part of an agent session the UI needs to offer it as a target. */
export const TargetSessionSchema = z.object({ id: z.string(), title: z.string(), mode: z.string(), status: z.string() })
export type TargetSession = z.infer<typeof TargetSessionSchema>

export const TARGET_KIND = { single: 'single', choose: 'choose', none: 'none' } as const
export const TargetResolutionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal(TARGET_KIND.single), session: TargetSessionSchema }),
  z.object({
    kind: z.literal(TARGET_KIND.choose),
    sessions: z.array(TargetSessionSchema),
    defaultSessionId: z.string(),
  }),
  z.object({ kind: z.literal(TARGET_KIND.none) }),
])
export type TargetResolution = z.infer<typeof TargetResolutionSchema>

export const SEND_ERROR_KEYS = [
  'notFound',
  'mixedWorktrees',
  'sessionNotRunning',
  'wrongWorktree',
  'noDeliveryTarget',
  'deliveryFailed',
  'alreadySending',
  'empty',
  'agentNotReady',
  'alreadyDelivered',
] as const
export type SendErrorKey = (typeof SEND_ERROR_KEYS)[number]
/** `{ notFound: 'notFound', … }` so code names the keys instead of repeating literals (§9). */
export const SEND_ERROR = Object.fromEntries(SEND_ERROR_KEYS.map((k) => [k, k])) as {
  readonly [K in SendErrorKey]: K
}
/** The i18n key the UI shows for a send error. */
export const sendErrorI18nKey = (k: SendErrorKey) => `comments:errors.${k}` as const

export const SEND_STATUS = {
  sent: 'sent',
  needsTarget: 'needsTarget',
  noSession: 'noSession',
  failed: 'failed',
} as const
const SEND_RESULT_KEY = 'status'
export const SendResultSchema = z.discriminatedUnion(SEND_RESULT_KEY, [
  z.object({
    status: z.literal(SEND_STATUS.sent),
    sessionId: z.string(),
    commentIds: z.array(z.string()),
    sentAt: z.number(),
  }),
  z.object({
    status: z.literal(SEND_STATUS.needsTarget),
    sessions: z.array(TargetSessionSchema),
    defaultSessionId: z.string(),
  }),
  z.object({ status: z.literal(SEND_STATUS.noSession) }),
  z.object({
    status: z.literal(SEND_STATUS.failed),
    errorKey: z.enum(SEND_ERROR_KEYS),
    message: z.string().optional(),
  }),
])
export type SendResult = z.infer<typeof SendResultSchema>
