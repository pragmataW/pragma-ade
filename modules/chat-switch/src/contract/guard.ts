import { createServiceToken } from '@pragma/sdk'
import { CHAT_SWITCH_SERVICE_IDS } from './constants'
import type { SwitchEligibility, SwitchResult, SwitchTarget } from './switch'

export interface ExternalSessionKey {
  providerId: string
  externalSessionId: string
}

export type ClaimResult = { ok: true } | { ok: false; ownerSessionId: string }

/** In memory: one app session per external conversation (provider-scoped). A session holds at most one key. */
export interface ExternalSessionGuard {
  claim(k: ExternalSessionKey, sessionId: string): ClaimResult
  release(sessionId: string): void
  ownerOf(k: ExternalSessionKey): string | undefined
}

export interface ChatSwitchService {
  eligibility(sessionId: string): Promise<SwitchEligibility>
  switchTo(sessionId: string, target: SwitchTarget): Promise<SwitchResult>
}

export const ExternalSessionGuardToken = createServiceToken<ExternalSessionGuard>(CHAT_SWITCH_SERVICE_IDS.guard)
export const ChatSwitchServiceToken = createServiceToken<ChatSwitchService>(CHAT_SWITCH_SERVICE_IDS.service)
