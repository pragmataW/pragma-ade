import {
  ABOUT_BLANK,
  COLON_PORT_RE,
  DOT,
  HOST_PORT_RE,
  HTTP_PREFIX,
  HTTP_URL_RE,
  HTTPS_PREFIX,
  LOCAL_HOST_PREFIX_RE,
  LOCALHOST,
  PORT_ONLY_RE,
  QUERY_PLACEHOLDER,
  SCHEME_RE,
  WHITESPACE_RE,
} from '../constants'

export const ADDRESS_KIND = { url: 'url', search: 'search' } as const
export type AddressKind = (typeof ADDRESS_KIND)[keyof typeof ADDRESS_KIND]
export type NormalizedAddress = { kind: AddressKind; url: string }

const href = (raw: string): string | null => {
  try {
    return new URL(raw).href
  } catch {
    return null
  }
}

function urlCandidate(input: string): string | null {
  if (input.toLowerCase() === ABOUT_BLANK) return ABOUT_BLANK
  if (HTTP_URL_RE.test(input)) return href(input)
  if (PORT_ONLY_RE.test(input)) return href(`${HTTP_PREFIX}${LOCALHOST}:${input}`)
  if (COLON_PORT_RE.test(input)) return href(`${HTTP_PREFIX}${LOCALHOST}${input}`)
  if (LOCAL_HOST_PREFIX_RE.test(input)) return href(HTTP_PREFIX + input)
  const schemeLike = SCHEME_RE.test(input) && !HOST_PORT_RE.test(input)
  if (!WHITESPACE_RE.test(input) && input.includes(DOT) && !schemeLike) return href(HTTPS_PREFIX + input)
  return null
}

/** What the address bar loads for `input`: a URL (port, local host, domain) or a search; null for blank input. */
export function normalizeAddressInput(input: string, searchUrl: string): NormalizedAddress | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const url = urlCandidate(trimmed)
  if (url) return { kind: ADDRESS_KIND.url, url }
  return { kind: ADDRESS_KIND.search, url: searchUrl.replace(QUERY_PLACEHOLDER, encodeURIComponent(trimmed)) }
}
