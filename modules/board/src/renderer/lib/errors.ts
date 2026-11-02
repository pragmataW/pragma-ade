import { BoardError } from '../../contract'

/** A banner message: an i18n key and its values, never a raw error code or message. */
export interface BoardNotice {
  messageKey: string
  values?: Record<string, string | undefined>
}

/** A board error code → its translated message; anything else (another module's error) → a generic one. */
export function errorNotice(e: unknown): BoardNotice {
  if (e instanceof BoardError) return { messageKey: `board:error.codes.${e.code}` }
  return { messageKey: 'board:error.unexpected' }
}
