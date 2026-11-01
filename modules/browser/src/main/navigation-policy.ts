// Adapted from stablyai/orca src/main/browser/browser-external-app-launch.ts (MIT) — see THIRD_PARTY_NOTICES.md
import { ABOUT_BLANK, INTERNAL_PROTOCOLS } from '../constants'

export const NAVIGATION_CLASS = { internal: 'internal', external: 'external', blocked: 'blocked' } as const
export type NavigationClass = (typeof NAVIGATION_CLASS)[keyof typeof NAVIGATION_CLASS]
export const NAVIGATION_CLASSES = Object.values(NAVIGATION_CLASS) as readonly NavigationClass[]

/**
 * Schemes never loaded in-app and never handed to the OS: web-internal schemes plus Chrome's `kDeniedSchemes`
 * (scripts, shell folders, shares). `about:` other than `about:blank` is blocked too.
 */
const NEVER_EXTERNAL: ReadonlySet<string> = new Set([
  'about:',
  'afp:',
  'blob:',
  'chrome:',
  'chrome-extension:',
  'data:',
  'devtools:',
  'disk:',
  'disks:',
  'file:',
  'filesystem:',
  'hcp:',
  'ie.http:',
  'javascript:',
  'ms-help:',
  'nntp:',
  'res:',
  'shell:',
  'vbscript:',
  'view-source:',
  'vnd.ms.radio:',
])

const protocolOf = (url: string): string | null => {
  try {
    return new URL(url).protocol
  } catch {
    return null
  }
}

/** internal = `http:`/`https:`/exact `about:blank`; blocked = denylisted or unparseable; everything else external. */
export function classifyNavigation(url: string): NavigationClass {
  if (url === ABOUT_BLANK) return NAVIGATION_CLASS.internal
  const protocol = protocolOf(url)
  if (protocol === null || NEVER_EXTERNAL.has(protocol)) return NAVIGATION_CLASS.blocked
  if ((INTERNAL_PROTOCOLS as readonly string[]).includes(protocol)) return NAVIGATION_CLASS.internal
  return NAVIGATION_CLASS.external
}
