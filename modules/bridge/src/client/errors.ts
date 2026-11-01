// No zod here: this file is bundled into hook scripts.
import type { BridgeErrorCodeName, BridgeUnavailableReason } from '../contract/constants'

/** The bridge cannot be used: no config found, nothing listening, or the token was rejected. */
export class BridgeUnavailableError extends Error {
  readonly reason: BridgeUnavailableReason
  constructor(reason: BridgeUnavailableReason, message: string = reason) {
    super(message)
    this.name = 'BridgeUnavailableError'
    this.reason = reason
  }
}

/** The bridge answered with `bridge.error`. */
export class BridgeRequestError extends Error {
  readonly code: BridgeErrorCodeName
  constructor(code: BridgeErrorCodeName, message: string = code) {
    super(message)
    this.name = 'BridgeRequestError'
    this.code = code
  }
}
