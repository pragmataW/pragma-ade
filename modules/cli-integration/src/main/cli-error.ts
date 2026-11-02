import type { CliErrorCode, CliErrorDto } from '../contract'

/** An expected failure of a `cli.*` request; travels to the CLI as `{ ok: false, error }`. */
export class CliError extends Error {
  readonly code: CliErrorCode
  readonly details: Record<string, unknown> | undefined
  constructor(code: CliErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'CliError'
    this.code = code
    this.details = details
  }

  toDto(): CliErrorDto {
    return { code: this.code, message: this.message, ...(this.details ? { details: this.details } : {}) }
  }
}
