import { z } from '@pragma/sdk'
import { SESSION_STATUS_STARTING, SWITCH_REASON, switchReasonKey } from '../constants'
import { type Eligibility, SWITCH_TARGET, type SwitchEligibility, type SwitchTarget } from '../contract'

/** The provider has no `chat` capability at all. */
export const NO_CHAT_CAPABILITY = 'no-capability'

const chatSupportSchema = z.union([
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), reasonKey: z.string() }),
  z.literal(NO_CHAT_CAPABILITY),
])

export const eligibilityInputSchema = z.object({
  session: z.object({ id: z.string(), mode: z.string(), status: z.string(), externalSessionId: z.string().nullable() }),
  hasResume: z.boolean(),
  canResumeInChat: z.boolean(),
  chatSupport: chatSupportSchema,
  busyOwnerSessionId: z.string().optional(),
  switching: z.boolean(),
})
export type EligibilityInput = z.infer<typeof eligibilityInputSchema>

const OK: Eligibility = { ok: true }
const no = (reason: keyof typeof SWITCH_REASON): Eligibility => ({ ok: false, reasonKey: switchReasonKey(reason) })

/** Rules shared by both targets, first match wins (null = none matched). */
function commonRule(input: EligibilityInput, target: SwitchTarget): Eligibility | null {
  const { session } = input
  if (target === session.mode) return no(SWITCH_REASON.currentMode)
  if (input.switching) return no(SWITCH_REASON.switching)
  if (session.status === SESSION_STATUS_STARTING) return no(SWITCH_REASON.starting)
  if (!input.hasResume) return no(SWITCH_REASON.noResume)
  if (!session.externalSessionId) return no(SWITCH_REASON.idUnknown)
  if (input.busyOwnerSessionId !== undefined && input.busyOwnerSessionId !== session.id) return no(SWITCH_REASON.busy)
  return null
}

function chatRule(input: EligibilityInput): Eligibility {
  if (!input.canResumeInChat) return no(SWITCH_REASON.chatResumeUnsupported)
  if (input.chatSupport === NO_CHAT_CAPABILITY) return no(SWITCH_REASON.noChat)
  return input.chatSupport.ok ? OK : { ok: false, reasonKey: input.chatSupport.reasonKey }
}

function evaluateTarget(input: EligibilityInput, target: SwitchTarget): Eligibility {
  const common = commonRule(input, target)
  if (common) return common
  switch (target) {
    case SWITCH_TARGET.terminal:
      return OK
    case SWITCH_TARGET.chat:
      return chatRule(input)
    default: {
      const never: never = target
      return never
    }
  }
}

/** Pure: why each target is (not) available; exited/error sessions stay eligible (03's relaunch handles them). */
export function evaluateSwitch(input: EligibilityInput): SwitchEligibility {
  return {
    terminal: evaluateTarget(input, SWITCH_TARGET.terminal),
    chat: evaluateTarget(input, SWITCH_TARGET.chat),
  }
}
