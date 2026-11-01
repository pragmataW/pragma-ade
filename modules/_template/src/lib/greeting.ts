import { DEFAULT_NAME, MAX_NAME_LENGTH } from '../constants'

/** Pure: the name to greet — trimmed, defaulted and capped. The sentence itself comes from i18n. */
export function formatGreeting(name: string | undefined): string {
  const trimmed = (name ?? '').trim()
  return (trimmed || DEFAULT_NAME).slice(0, MAX_NAME_LENGTH)
}
